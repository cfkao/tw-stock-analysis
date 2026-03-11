"""
新聞與重大訊息服務
負責從 Yahoo Finance RSS 取得並解析個股新聞
"""
import ssl
import httpx
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import logging
import difflib

logger = logging.getLogger(__name__)

class NewsService:
    @staticmethod
    async def get_stock_news(stock_id: str, limit: int = 15) -> list[dict]:
        """從 Yahoo Finance RSS 取得個股新聞"""
        # Yahoo Finance RSS 預期的是台灣代號加上 .TW 例如 2330.TW
        symbol = f"{stock_id}.TW"
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=TW&lang=zh-Hant-TW"

        # 在某些 Mac/Linux 環境如果遇到 SSL 憑證問題，我們建立一個忽略驗證的 context
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        try:
            async with httpx.AsyncClient(verify=ssl_context, timeout=10.0) as client:
                response = await client.get(
                    url, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
                )
                response.raise_for_status()
                
                # 解析 XML
                root = ET.fromstring(response.text)
                items = root.findall('.//item')
                
                news_list = []
                
                # Retrieve sufficient items to allow for grouping while still reaching `limit` main items
                # We'll fetch more items initially since grouping will reduce the total count
                for item in items[:limit * 3]:
                    if len(news_list) >= limit:
                        break

                    # 嘗試格式化日期
                    pub_date_str = item.findtext('pubDate') or ''
                    dt = None
                    try:
                        if pub_date_str:
                            dt = parsedate_to_datetime(pub_date_str)
                            pub_date_formatted = dt.strftime('%Y-%m-%d %H:%M')
                        else:
                            pub_date_formatted = ''
                    except Exception:
                        pub_date_formatted = pub_date_str

                    # 過濾三個月內的新聞
                    if dt:
                        # Ensure both are timezone-aware or both are naive
                        now = datetime.now(timezone.utc)
                        # parsedate_to_datetime usually returns a timezone-aware datetime (UTC or offset). 
                        # If dt is naive, we need to make 'now' naive too, but let's assume it's aware.
                        if dt.tzinfo is None:
                            now = datetime.now()
                            
                        three_months_ago = now - timedelta(days=90)
                        if dt < three_months_ago:
                            continue

                    title = item.findtext('title') or '無標題'
                    
                    news_entry = {
                        "title": title,
                        "link": item.findtext('link') or '',
                        "pub_date": pub_date_formatted,
                        "source": "Yahoo 財經",
                        "description": item.findtext('description') or '',
                        "related_news": []
                    }
                    
                    # Check for similarity with existing main items
                    is_duplicate = False
                    for existing in news_list:
                        similarity = difflib.SequenceMatcher(None, existing["title"], title).ratio()
                        if similarity > 0.6:
                            existing["related_news"].append(news_entry)
                            is_duplicate = True
                            break
                            
                    if not is_duplicate:
                        news_list.append(news_entry)
                    
                return news_list
                
        except Exception as e:
            logger.error(f"取得 {stock_id} 新聞失敗: {str(e)}")
            return []

news_service = NewsService()
