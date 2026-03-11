import os
import json
import logging
from openai import AsyncOpenAI
from app.config import settings
from app.schemas.llm import NewsAnalysisResponse

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        # 初始化 OpenAI Client
        api_key = settings.openai_api_key
        if not api_key:
            logger.warning("OPENAI_API_KEY is not set. LLM features will not work.")
            self.client = None
        else:
            self.client = AsyncOpenAI(api_key=api_key)

    async def analyze_stock_news(self, stock_id: str, news_list: list[dict]) -> NewsAnalysisResponse | None:
        """
        分析個股近期新聞，提取投資洞察
        :param stock_id: 股票代號
        :param news_list: 新聞列表 (包含 title, description 等)
        """
        if not self.client:
            logger.error("Cannot analyze news: OpenAI Client is not initialized.")
            return None

        if not news_list:
            return None

        # 準備送給 LLM 的新聞文本
        news_text = ""
        for i, news in enumerate(news_list, 1):
            news_text += f"\n[新聞 {i}]\n標題: {news.get('title', '')}\n摘要: {news.get('description', '')}\n"

        system_prompt = """
        你是一位專業的台股證券分析師與投資顾问。
        請根據使用者提供的「近期個股新聞」，進行客觀、專業的分析，並提取關鍵投資洞察。
        你需要判斷目前的市場情緒，總結出近期炒作或關注的熱門題材 (Themes)，並客觀列出潛在的買進理由(利多)與觀望風險(利空)。
        
        請強制以 JSON 格式回傳，必須完全符合以下結構，不要包含任何額外的 Markdown 標記 (如 ```json)：
        {
            "sentiment_score": 整數，範圍 -100 (極度悲觀/強烈利空) 到 100 (極度樂觀/強烈利多)，0 為中立,
            "themes": ["短標籤1", "短標籤2"], // 例如 ["AI伺服器", "營收創高"]，最多 4 個
            "pros": ["利多因素1", "利多因素2"], // 條列式，每個因素盡量簡短明確
            "cons": ["利空因素1", "利空因素2"], // 條列式，客觀點出風險
            "summary": "一段 50 字以內的精煉總結，描述目前整體的市場預期與營運主軸。"
        }
        """

        user_prompt = f"請分析以下關於股票代號 {stock_id} 的近期新聞：\n{news_text}"

        try:
            logger.info(f"🤖 開始呼叫 OpenAI 分析 {stock_id} 新聞 (共 {len(news_list)} 篇)...")
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={ "type": "json_object" },
                temperature=0.3,
            )

            result_text = response.choices[0].message.content
            if not result_text:
                return None
                
            result_json = json.loads(result_text)
            
            analysis = NewsAnalysisResponse(**result_json)
            logger.info(f"✅ LLM 分析完成: {stock_id} (分數: {analysis.sentiment_score})")
            return analysis

        except Exception as e:
            logger.error(f"❌ OpenAI API 呼叫失敗 [{stock_id}]: {e}")
            logger.info("⚠️ 由於 API 呼叫失敗 (可能是額度不足)，回傳模擬的 AI 洞察結果供 UI 測試使用。")
            
            # 產生基於真實新聞標題的模擬數據
            sample_themes = []
            sample_pros = []
            sample_cons = []
            
            # 從新聞標題抓前幾個字當作假主題
            for news in news_list[:2]:
                title = news.get("title", "")
                if len(title) > 5:
                    sample_themes.append(title[:6])
                    sample_pros.append(f"從近期報導看出「{title[:10]}...」的正面發展潛力。")
                
            for news in news_list[2:4]:
                title = news.get("title", "")
                if len(title) > 5:
                    sample_cons.append(f"需留意「{title[:10]}...」可能帶來的短期波動風險。")
                    
            if not sample_themes:
                 sample_themes = ["營收創高", "AI伺服器"]
                 sample_pros = ["第一季法說會釋出樂觀展望，毛利率有望維持高檔。", "外資連續買超，籌碼面相對穩定。"]
                 sample_cons = ["面臨消費性電子復甦放緩的系統性風險。", "短期漲多可能引發獲利了結賣壓。"]

            return NewsAnalysisResponse(
                sentiment_score=45,
                themes=sample_themes[:2] + ["[模擬數據]"],
                pros=sample_pros,
                cons=sample_cons,
                summary=f"【此為 API 額度用盡的模擬預覽】近三個月關於 {stock_id} 的新聞整體偏向樂觀，市場聚焦於新產品出貨動能，但仍需留意總體經濟帶來的不確定性。"
            )

llm_service = LLMService()
