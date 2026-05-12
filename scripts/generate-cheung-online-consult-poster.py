from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
AVATAR_PATH = ROOT / "public/doctor-avatars/cheung.jpg"
LOGO_PATH = ROOT / "public/images/eden-logo-full-lockup.png"
OUTPUT_PATH = ROOT / "public/images/cheung-online-consult-poster-2026.png"
BOOKING_URL = "https://edenchatbot-booking.vercel.app/booking?doctor=cheung&clinic=online"

W, H = 1080, 1350

CREAM = (250, 247, 238)
PAPER = (255, 253, 247)
GREEN = (0, 101, 52)
DARK_GREEN = (0, 61, 34)
LEAF = (79, 142, 61)
GOLD = (190, 140, 49)
SOFT_GOLD = (236, 209, 143)
BROWN = (91, 64, 35)
INK = (36, 43, 35)
MUTED = (99, 108, 93)
WHITE = (255, 255, 255)

SONGTI = "/System/Library/Fonts/Supplemental/Songti.ttc"
HIRAGINO_MINCHO = "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc"
PINGFANG = (
    "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/"
    "86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc"
)
PINGFANG_FALLBACK = "/System/Library/Fonts/PingFang.ttc"
HEITI = "/System/Library/Fonts/STHeiti Light.ttc"


def font(candidates: list[str], size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size, index=index)
    return ImageFont.load_default()


TITLE_FONT = font([HIRAGINO_MINCHO, SONGTI, HEITI], 96)
NAME_FONT = font([HIRAGINO_MINCHO, SONGTI, HEITI], 62)
SUBTITLE_FONT = font([PINGFANG, PINGFANG_FALLBACK, HEITI], 34, index=2)
BODY_FONT = font([PINGFANG, PINGFANG_FALLBACK, HEITI], 36, index=2)
BODY_BOLD = font([PINGFANG, PINGFANG_FALLBACK, HEITI], 44, index=2)
SMALL_FONT = font([PINGFANG, PINGFANG_FALLBACK, HEITI], 26, index=2)
TINY_FONT = font([PINGFANG, PINGFANG_FALLBACK, HEITI], 20, index=2)
EN_FONT = font([PINGFANG, PINGFANG_FALLBACK, HEITI], 24, index=1)


def text_size(draw: ImageDraw.ImageDraw, text: str, active_font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=active_font)
    return box[2] - box[0], box[3] - box[1]


def draw_centered(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    text: str,
    active_font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    *,
    stroke_width: int = 0,
    stroke_fill: tuple[int, int, int] | None = None,
) -> None:
    box = draw.textbbox((0, 0), text, font=active_font, stroke_width=stroke_width)
    x = center[0] - (box[2] - box[0]) // 2 - box[0]
    y = center[1] - (box[3] - box[1]) // 2 - box[1]
    draw.text(
        (x, y),
        text,
        font=active_font,
        fill=fill,
        stroke_width=stroke_width,
        stroke_fill=stroke_fill,
    )


def draw_shadowed_round_rect(
    base: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int] | tuple[int, int, int, int],
    *,
    outline: tuple[int, int, int] | None = None,
    width: int = 1,
    shadow=(0, 0, 0, 24),
    blur=18,
    offset=(0, 8),
) -> None:
    shadow_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    shifted = (
        box[0] + offset[0],
        box[1] + offset[1],
        box[2] + offset[0],
        box[3] + offset[1],
    )
    sd.rounded_rectangle(shifted, radius=radius, fill=shadow)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow_layer)
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_vertical_gradient(top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    for y in range(H):
        t = y / max(H - 1, 1)
        arr[y, :, :] = [
            int(top[i] * (1 - t) + bottom[i] * t)
            for i in range(3)
        ]
    return Image.fromarray(arr, "RGB").convert("RGBA")


def make_leaf(scale: float, angle: float, color: tuple[int, int, int]) -> Image.Image:
    length = int(52 * scale)
    width = int(22 * scale)
    leaf = Image.new("RGBA", (length + 20, width + 20), (0, 0, 0, 0))
    ld = ImageDraw.Draw(leaf)
    ld.ellipse((8, 5, length, width + 5), fill=color + (165,), outline=(255, 255, 255, 72), width=1)
    ld.line((10, width // 2 + 5, length - 2, width // 2 + 5), fill=(255, 255, 255, 105), width=max(1, int(2 * scale)))
    return leaf.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)


def add_background(base: Image.Image) -> None:
    draw = ImageDraw.Draw(base)
    for offset, color in ((0, SOFT_GOLD), (18, GREEN)):
        draw.rounded_rectangle((32 + offset, 32 + offset, W - 32 - offset, H - 32 - offset), radius=36, outline=color, width=3)

    motif = Image.new("RGBA", base.size, (0, 0, 0, 0))
    for idx, y in enumerate(range(70, 430, 58)):
        motif.alpha_composite(make_leaf(0.8, -32, LEAF if idx % 2 else GOLD), (30 + idx * 8, y))
        motif.alpha_composite(make_leaf(0.72, 210, LEAF if idx % 2 else GOLD), (W - 92 - idx * 5, y + 20))
    for idx, y in enumerate(range(1000, 1270, 54)):
        motif.alpha_composite(make_leaf(0.62, 24, LEAF if idx % 2 else GOLD), (42 + idx * 7, y))
        motif.alpha_composite(make_leaf(0.68, 205, LEAF if idx % 2 else GOLD), (W - 92 - idx * 5, y - 10))
    base.alpha_composite(motif)


def paste_logo(base: Image.Image) -> None:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo.thumbnail((360, 100), Image.Resampling.LANCZOS)
    base.alpha_composite(logo, ((W - logo.width) // 2, 68))


def paste_doctor_photo(base: Image.Image) -> None:
    photo = Image.open(AVATAR_PATH).convert("RGB")
    crop = photo.crop((250, 0, 600, 338))
    crop = ImageOps.fit(crop, (400, 470), method=Image.Resampling.LANCZOS, centering=(0.72, 0.45)).convert("RGBA")

    mask = Image.new("L", crop.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, crop.width - 1, crop.height - 1), radius=34, fill=255)

    panel = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    panel.alpha_composite(crop)
    panel.putalpha(mask)

    x, y = 610, 390
    draw_shadowed_round_rect(base, (x - 16, y - 16, x + crop.width + 16, y + crop.height + 16), 44, PAPER, outline=SOFT_GOLD, width=4)
    base.alpha_composite(panel, (x, y))

    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle((x, y, x + crop.width, y + crop.height), radius=34, outline=(255, 255, 255, 205), width=6)
    od.rounded_rectangle((x + 16, y + 16, x + crop.width - 16, y + crop.height - 16), radius=24, outline=(0, 101, 52, 90), width=2)
    base.alpha_composite(overlay)


def create_qr(url: str, size: int) -> Image.Image:
    params = cv2.QRCodeEncoder_Params()
    params.correction_level = cv2.QRCodeEncoder_CORRECT_LEVEL_H
    encoder = cv2.QRCodeEncoder_create(params)
    matrix = encoder.encode(url)
    if matrix.max() == 1:
        matrix = matrix * 255
    matrix = np.asarray(matrix, dtype=np.uint8)
    quiet_zone = max(18, size // 12)
    inner_size = size - quiet_zone * 2
    qr = Image.fromarray(matrix, mode="L").convert("RGB")
    qr = qr.resize((inner_size, inner_size), Image.Resampling.NEAREST)
    arr = np.asarray(qr)
    dark = arr[:, :, 0] < 128
    colored = np.full(arr.shape, 255, dtype=np.uint8)
    colored[dark] = (31, 24, 13)
    qr_colored = Image.fromarray(colored, mode="RGB")
    canvas = Image.new("RGB", (size, size), WHITE)
    canvas.paste(qr_colored, (quiet_zone, quiet_zone))
    return canvas


def draw_bullet(draw: ImageDraw.ImageDraw, x: int, y: int, text: str) -> None:
    draw.ellipse((x, y + 13, x + 14, y + 27), fill=GOLD)
    draw.text((x + 32, y), text, font=BODY_FONT, fill=INK)


def draw_content(base: Image.Image) -> None:
    draw = ImageDraw.Draw(base)

    draw_centered(draw, (W // 2, 225), "網上診症", TITLE_FONT, DARK_GREEN, stroke_width=1, stroke_fill=(240, 234, 217))
    draw_centered(draw, (W // 2, 306), "張天慧醫師", NAME_FONT, GREEN)
    draw_centered(draw, (W // 2, 355), "Online Consultation", EN_FONT, BROWN)

    draw_shadowed_round_rect(base, (84, 430, 548, 760), 34, (255, 255, 255, 232), outline=(226, 211, 171), width=3, shadow=(0, 0, 0, 14), blur=16)
    draw.text((132, 474), "逢星期三、四", font=BODY_BOLD, fill=DARK_GREEN)
    draw.line((132, 536, 500, 536), fill=SOFT_GOLD, width=3)
    draw.text((132, 570), "晚上", font=BODY_FONT, fill=MUTED)
    draw.text((132, 620), "21:30 - 23:30", font=font([PINGFANG, PINGFANG_FALLBACK, HEITI], 58, index=2), fill=GREEN)
    draw.text((132, 700), "20 分鐘一節", font=BODY_FONT, fill=BROWN)

    draw_shadowed_round_rect(base, (84, 810, 996, 1000), 30, (0, 92, 48, 238), outline=(210, 170, 77), width=3, shadow=(0, 0, 0, 18), blur=18)
    draw_centered(draw, (540, 862), "Google Meet 視像診症", BODY_BOLD, WHITE)
    draw_centered(draw, (540, 926), "適合覆診、調理跟進、藥方諮詢", BODY_FONT, (246, 241, 221))

    draw_shadowed_round_rect(base, (84, 1048, 640, 1220), 26, (255, 255, 255, 232), outline=(230, 217, 181), width=3, shadow=(0, 0, 0, 12), blur=12)
    draw_bullet(draw, 124, 1090, "預約時可選首診 / 覆診")
    draw_bullet(draw, 124, 1144, "預約成功後會收到診症連結")

    qr_box = (680, 1020, 986, 1294)
    draw_shadowed_round_rect(base, qr_box, 28, PAPER, outline=GOLD, width=4, shadow=(0, 0, 0, 16), blur=16)
    qr = create_qr(BOOKING_URL, 246).convert("RGBA")
    base.alpha_composite(qr, (710, 1038))
    draw_centered(draw, (833, 1008), "掃描預約", SMALL_FONT, DARK_GREEN)


def main() -> None:
    base = make_vertical_gradient(CREAM, (245, 241, 227))
    add_background(base)
    paste_logo(base)
    paste_doctor_photo(base)
    draw_content(base)
    base.convert("RGB").save(OUTPUT_PATH, quality=98)
    print(OUTPUT_PATH)
    print(BOOKING_URL)


if __name__ == "__main__":
    main()
