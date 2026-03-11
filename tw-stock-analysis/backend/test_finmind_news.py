import asyncio
from app.services.finmind import finmind_service

async def test():
    print("Testing FinMind News API...")
    try:
        data = await finmind_service._fetch(
            dataset="TaiwanStockNews",
            data_id="2330",
            start_date="2024-03-01",
            end_date="2024-03-11"
        )
        print("Data length:", len(data))
        if len(data) > 0:
            print("Sample data:", data[0])
    except Exception as e:
        print("Error:", str(e))

if __name__ == "__main__":
    asyncio.run(test())
