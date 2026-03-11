import asyncio
from app.services.finmind import finmind_service

async def main():
    try:
        data = await finmind_service.get_stock_price("2330", "2024-01-01")
        print(f"Data length: {len(data)}")
        if data: print(data[0])
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
