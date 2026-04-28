from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "public/images/chan-timetable-may-2026.png"
AVATAR_PATH = ROOT / "public/doctor-avatars/hon.jpg"
OUTPUT_PATH = ROOT / "public/images/hon-timetable-may-2026.png"
BOOKING_URL = "https://edenchatbot-booking.vercel.app/booking?doctor=hon"

CREAM = (249, 246, 237)
GREEN = (0, 104, 52)
DARK_GREEN = (0, 74, 37)
GOLD = (195, 146, 58)
BROWN = (60, 34, 20)
JORDAN_GOLD = (177, 126, 21)
JORDAN_BG = (255, 248, 235)
GREEN_CARD_BG = (250, 252, 244)
REST_BG = (247, 248, 248)
REST_STROKE = (219, 224, 224)
GREEN_STROKE = (209, 229, 210)
JORDAN_STROKE = (242, 207, 158)

SONGTI = "/System/Library/Fonts/Supplemental/Songti.ttc"
HIRAGINO_MINCHO = "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc"
PINGFANG = (
    "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/"
    "86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc"
)


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size, index=index)


TITLE_FONT = font(HIRAGINO_MINCHO, 58)
HEADER_FONT = font(SONGTI, 34)
CLINIC_FONT = font(PINGFANG, 38, index=2)
TIME_FONT = font(PINGFANG, 30, index=2)
REST_FONT = font(PINGFANG, 42, index=2)
SMALL_FONT = font(PINGFANG, 24, index=2)
QR_LABEL_FONT = font(PINGFANG, 24, index=2)


def text_size(draw: ImageDraw.ImageDraw, text: str, active_font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=active_font)
    return box[2] - box[0], box[3] - box[1]


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    text: str,
    active_font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    *,
    stroke_width: int = 0,
    stroke_fill: tuple[int, int, int] | None = None,
) -> None:
    box = draw.textbbox((0, 0), text, font=active_font)
    width = box[2] - box[0]
    height = box[3] - box[1]
    x = center[0] - width // 2 - box[0]
    y = center[1] - height // 2 - box[1]
    draw.text(
        (x, y),
        text,
        font=active_font,
        fill=fill,
        stroke_width=stroke_width,
        stroke_fill=stroke_fill,
    )


def draw_tracked_title(draw: ImageDraw.ImageDraw, center: tuple[int, int], text: str) -> None:
    tracking = 8
    widths = [draw.textlength(ch, font=TITLE_FONT) for ch in text]
    total = int(sum(widths) + tracking * (len(text) - 1))
    x = center[0] - total // 2
    y = center[1] - 35
    for ch, width in zip(text, widths):
        for dx, dy in ((0, 0), (1, 0), (0, 1)):
            draw.text((x + dx, y + dy), ch, font=TITLE_FONT, fill=DARK_GREEN)
        x += int(width) + tracking


def rounded_shadow(
    base: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    *,
    shadow=(0, 0, 0, 18),
    offset=(0, 3),
    blur=8,
) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    shifted = (box[0] + offset[0], box[1] + offset[1], box[2] + offset[0], box[3] + offset[1])
    d.rounded_rectangle(shifted, radius=radius, fill=shadow)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)


def draw_pin(draw: ImageDraw.ImageDraw, center: tuple[int, int], fill: tuple[int, int, int]) -> None:
    x, y = center
    draw.ellipse((x - 12, y - 15, x + 12, y + 9), fill=fill)
    draw.polygon([(x - 9, y + 2), (x + 9, y + 2), (x, y + 23)], fill=fill)
    draw.ellipse((x - 4, y - 7, x + 4, y + 1), fill=(255, 255, 255))


def draw_session(
    base: Image.Image,
    box: tuple[int, int, int, int],
    clinic: str,
    start: str,
    end: str,
    *,
    accent: tuple[int, int, int],
    text_fill: tuple[int, int, int],
    bg: tuple[int, int, int],
    stroke: tuple[int, int, int],
) -> None:
    draw = ImageDraw.Draw(base)
    rounded_shadow(base, box, 11, shadow=(0, 0, 0, 14), blur=7)
    draw.rounded_rectangle(box, radius=11, fill=bg, outline=stroke, width=3)

    x1, y1, x2, y2 = box
    cx = (x1 + x2) // 2
    draw_pin(draw, (cx, y1 + 62), accent)
    draw_centered_text(draw, (cx, y1 + 143), clinic, CLINIC_FONT, text_fill)
    draw.line((x1 + 23, y1 + 185, x2 - 23, y1 + 185), fill=text_fill, width=1)
    draw_centered_text(draw, (cx, y1 + 236), start, TIME_FONT, text_fill)
    draw.line((cx, y1 + 263, cx, y1 + 296), fill=text_fill, width=4)
    draw_centered_text(draw, (cx, y1 + 318), end, TIME_FONT, text_fill)


def draw_rest(base: Image.Image, box: tuple[int, int, int, int]) -> None:
    draw = ImageDraw.Draw(base)
    rounded_shadow(base, box, 11, shadow=(0, 0, 0, 13), blur=7)
    draw.rounded_rectangle(box, radius=11, fill=REST_BG, outline=REST_STROKE, width=3)
    x1, y1, x2, y2 = box
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    draw.ellipse((cx - 31, cy - 100, cx - 8, cy - 68), fill=(141, 186, 143))
    draw.ellipse((cx + 5, cy - 112, cx + 29, cy - 74), fill=(160, 203, 161))
    draw.line((cx - 13, cy - 70, cx + 19, cy - 103), fill=(113, 159, 115), width=2)
    draw_centered_text(draw, (cx, cy - 5), "休息", REST_FONT, DARK_GREEN)
    draw.line((cx - 28, cy + 48, cx - 8, cy + 48), fill=(111, 111, 111), width=1)
    draw_centered_text(draw, (cx, cy + 48), "❖", SMALL_FONT, (88, 88, 88))
    draw.line((cx + 8, cy + 48, cx + 28, cy + 48), fill=(111, 111, 111), width=1)


def paste_avatar(base: Image.Image) -> None:
    avatar = Image.open(AVATAR_PATH).convert("RGB")
    crop = avatar.crop((0, 0, 338, 338))
    size = 218
    crop = crop.resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    base.paste(crop, (123, 90), mask)
    draw = ImageDraw.Draw(base)
    draw.ellipse((111, 78, 353, 320), outline=(225, 238, 222), width=10)
    draw.ellipse((113, 80, 351, 318), outline=GREEN, width=7)


def create_qr(url: str, size: int) -> Image.Image:
    params = cv2.QRCodeEncoder_Params()
    params.correction_level = cv2.QRCodeEncoder_CORRECT_LEVEL_H
    encoder = cv2.QRCodeEncoder_create(params)
    matrix = encoder.encode(url)
    if matrix.max() == 1:
        matrix = matrix * 255
    matrix = np.asarray(matrix, dtype=np.uint8)
    qr = Image.fromarray(matrix, mode="L").convert("RGB")
    qr = qr.resize((size, size), Image.Resampling.NEAREST)
    arr = np.asarray(qr)
    dark = arr[:, :, 0] < 128
    colored = np.full(arr.shape, 255, dtype=np.uint8)
    colored[dark] = (31, 18, 11)
    return Image.fromarray(colored, mode="RGB")


def paste_qr(base: Image.Image) -> None:
    draw = ImageDraw.Draw(base)
    draw.rectangle((80, 1264, 406, 1468), fill=CREAM)
    outer = (151, 1268, 392, 1466)
    draw.rounded_rectangle(outer, radius=12, fill=(255, 253, 247), outline=GOLD, width=3)
    qr = create_qr(BOOKING_URL, 190)
    base.paste(qr, (176, 1274))


def draw_schedule(base: Image.Image) -> None:
    draw = ImageDraw.Draw(base)
    draw.rectangle((26, 498, 998, 1284), fill=CREAM)

    days = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
    xs = [38, 176, 314, 452, 590, 728, 866]
    col_w = 122
    header_y, header_h = 510, 58
    for x, day in zip(xs, days):
        rounded_shadow(base, (x, header_y, x + col_w, header_y + header_h), 8, shadow=(0, 0, 0, 16), blur=5)
        draw.rounded_rectangle((x, header_y, x + col_w, header_y + header_h), radius=8, fill=GREEN)
        draw_centered_text(draw, (x + col_w // 2, header_y + header_h // 2), day, HEADER_FONT, (255, 255, 255))

    top_y = 584
    bottom_y = 936
    card_h = 330
    full_h = bottom_y + card_h - top_y

    def green_card(col: int, row_y: int, clinic: str, start: str, end: str) -> None:
        draw_session(
            base,
            (xs[col], row_y, xs[col] + col_w, row_y + card_h),
            clinic,
            start,
            end,
            accent=GREEN,
            text_fill=DARK_GREEN,
            bg=GREEN_CARD_BG,
            stroke=GREEN_STROKE,
        )

    def jordan_card(col: int, row_y: int, start: str, end: str) -> None:
        draw_session(
            base,
            (xs[col], row_y, xs[col] + col_w, row_y + card_h),
            "佐敦",
            start,
            end,
            accent=JORDAN_GOLD,
            text_fill=BROWN,
            bg=JORDAN_BG,
            stroke=JORDAN_STROKE,
        )

    green_card(0, top_y, "荃灣", "10:30", "14:00")
    green_card(0, bottom_y, "荃灣", "15:30", "19:00")
    draw_rest(base, (xs[1], top_y, xs[1] + col_w, top_y + full_h))
    jordan_card(2, top_y, "11:00", "14:00")
    jordan_card(2, bottom_y, "15:30", "19:30")
    green_card(3, bottom_y, "中環", "15:30", "19:30")
    jordan_card(4, top_y, "11:00", "14:00")
    green_card(4, bottom_y, "中環", "15:30", "19:30")
    draw_rest(base, (xs[5], top_y, xs[5] + col_w, top_y + full_h))
    green_card(6, top_y, "荃灣", "10:30", "14:00")
    green_card(6, bottom_y, "荃灣", "15:30", "19:00")


def main() -> None:
    base = Image.open(TEMPLATE_PATH).convert("RGBA")
    draw = ImageDraw.Draw(base)
    draw.rectangle((320, 96, 734, 205), fill=CREAM)
    draw_tracked_title(draw, (555, 155), "韓曉恩醫師")
    paste_avatar(base)
    draw_schedule(base)
    paste_qr(base)
    base.convert("RGB").save(OUTPUT_PATH, quality=98)
    print(OUTPUT_PATH)
    print(BOOKING_URL)


if __name__ == "__main__":
    main()
