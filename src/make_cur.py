"""
make_cur.py — PNG를 Windows .cur 파일로 변환
Usage: python make_cur.py input.png output.cur hotX hotY
"""
import sys, struct, os

def png_to_cur(png_path, cur_path, hot_x=0, hot_y=0):
    with open(png_path, 'rb') as f:
        png_data = f.read()

    # .cur 파일 구조: ICONDIR + ICONDIRENTRY + image data
    # ICONDIR (6 bytes)
    icon_dir = struct.pack('<HHH', 0, 2, 1)  # reserved=0, type=2(cursor), count=1

    img_size = len(png_data)
    offset = 6 + 16  # ICONDIR + one ICONDIRENTRY

    # ICONDIRENTRY (16 bytes)
    # width, height, colorCount, reserved, xHotspot, yHotspot, dwBytesInRes, dwImageOffset
    # We use 0,0 for width/height to let Windows read from PNG header
    entry = struct.pack('<BBBBHHII', 0, 0, 0, 0, hot_x, hot_y, img_size, offset)

    with open(cur_path, 'wb') as f:
        f.write(icon_dir + entry + png_data)

    print(f"Saved: {cur_path}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: make_cur.py input.png output.cur [hotX] [hotY]")
        sys.exit(1)
    hx = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    hy = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    png_to_cur(sys.argv[1], sys.argv[2], hx, hy)
