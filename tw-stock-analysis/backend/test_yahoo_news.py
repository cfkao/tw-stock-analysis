import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

def test():
    print("Testing Yahoo News RSS...")
    stock_id = "2330.TW"
    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={stock_id}&region=TW&lang=zh-Hant-TW"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            xml_data = response.read()
            root = ET.fromstring(xml_data)
            items = root.findall('.//item')
            print(f"Found {len(items)} news items")
            if items:
                print("Sample title:", items[0].find('title').text)
                print("Sample link:", items[0].find('link').text)
                print("Sample pubDate:", items[0].find('pubDate').text)
    except Exception as e:
        print("Error:", str(e))

if __name__ == "__main__":
    test()
