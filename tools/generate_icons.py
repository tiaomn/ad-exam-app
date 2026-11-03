#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一键生成 Android / iOS / PWA 图标与启动图。
用法：  python tools/generate_icons.py
只依赖 Pillow（pip install pillow）。
默认读取 ../input/1.jpg，输出到 assets/ 与 www/assets/。
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "input" / "1.jpg"
if not SOURCE.exists():
    SOURCE = ROOT.parent / "input" / "1.jpg"
ASSETS = ROOT / "assets"
WWW_ASSETS = ROOT / "www" / "assets"
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")

BG_TOP = (255, 213, 74)
BG_BOTTOM = (244, 177, 7)
CREAM = (255, 249, 232)
INK = (56, 45, 22)
GREEN = (47, 158, 102)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold else FONT_REGULAR
    try:
        return ImageFont.truetype(str(path), size)
    except Exception:
        return ImageFont.load_default()


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG_TOP)
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        r = round(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t)
        g = round(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t)
        b = round(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    # soft radial highlight, top-left
    glow = Image.new("L", (size, size), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-size * 0.25, -size * 0.4, size * 0.85, size * 0.65), fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.14))
    light = Image.new("RGB", (size, size), (255, 241, 173))
    img = Image.composite(light, img, glow.point(lambda v: int(v * 0.55)))
    return img


def remove_white(path: Path) -> Image.Image:
    """Remove the light, neutral background (including the floor shadow).

    A saturation/value mask covers white and light gray. Only the part connected
    to the image border is removed, so enclosed white details (teeth, eye
    highlights, belly) stay intact.
    """
    im = Image.open(path).convert("RGBA")
    hsv = np.array(im.convert("HSV"))
    saturation, value = hsv[:, :, 1], hsv[:, :, 2]
    candidate = (saturation < 42) & (value > 150)
    mask = Image.fromarray((candidate * 255).astype("uint8"))
    w, h = mask.size
    ImageDraw.Draw(mask).rectangle((0, 0, w - 1, h - 1), outline=255)
    ImageDraw.floodfill(mask, (0, 0), 128, thresh=0)
    background = np.array(mask) == 128
    alpha = Image.fromarray(np.where(background, 0, 255).astype("uint8"))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.7))
    im.putalpha(alpha)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def fit(img: Image.Image, box_w: int, box_h: int) -> Image.Image:
    ratio = min(box_w / img.width, box_h / img.height)
    size = (max(1, round(img.width * ratio)), max(1, round(img.height * ratio)))
    return img.resize(size, Image.LANCZOS)


def paste_center(base: Image.Image, img: Image.Image, cx: int, cy: int) -> None:
    base.alpha_composite(img, (round(cx - img.width / 2), round(cy - img.height / 2)))


def sparkle(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color: tuple[int, int, int, int]) -> None:
    pts = []
    for i in range(8):
        a = math.pi / 4 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.3
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    draw.polygon(pts, fill=color)


def icon_full(dino: Image.Image, size: int = 1024) -> Image.Image:
    base = gradient(size).convert("RGBA")
    s = size / 1024
    draw = ImageDraw.Draw(base)
    # Halo behind the character.
    draw.ellipse((122 * s, 135 * s, 902 * s, 915 * s), fill=CREAM + (255,))
    draw.ellipse((164 * s, 177 * s, 860 * s, 873 * s), outline=(255, 255, 255, 110), width=max(2, round(5 * s)))
    sparkle(draw, round(190 * s), round(260 * s), round(34 * s), (255, 255, 255, 190))
    sparkle(draw, round(842 * s), round(318 * s), round(25 * s), (255, 255, 255, 170))
    sparkle(draw, round(796 * s), round(748 * s), round(17 * s), (255, 255, 255, 130))

    d = fit(dino, round(620 * s), round(760 * s))
    # Ground shadow.
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse((round(245 * s), round(830 * s), round(780 * s), round(925 * s)), fill=(120, 82, 0, 65))
    shadow = shadow.filter(ImageFilter.GaussianBlur(round(18 * s)))
    base.alpha_composite(shadow)
    paste_center(base, d, round(size / 2), round(525 * s))
    return base


def icon_round(dino: Image.Image, size: int = 1024) -> Image.Image:
    full = icon_full(dino, size)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((6, 6, size - 6, size - 6), fill=255)
    full.putalpha(mask)
    return full


def icon_foreground(dino: Image.Image, size: int = 1024) -> Image.Image:
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s = size / 1024
    draw = ImageDraw.Draw(base)
    # Kept inside Android's 66% adaptive-icon safe zone.
    draw.ellipse((214 * s, 224 * s, 810 * s, 820 * s), fill=CREAM + (255,))
    d = fit(dino, round(500 * s), round(600 * s))
    paste_center(base, d, round(size / 2), round(535 * s))
    return base


def icon_background(size: int = 1024) -> Image.Image:
    return gradient(size).convert("RGBA")


def splash(dino: Image.Image, size: int = 2732) -> Image.Image:
    base = Image.new("RGBA", (size, size), (251, 247, 236, 255))
    s = size / 2732
    draw = ImageDraw.Draw(base)
    # Decorative rings.
    for rr, alpha in ((760, 40), (910, 26), (1060, 16)):
        draw.ellipse((size / 2 - rr * s, size / 2 - rr * s, size / 2 + rr * s, size / 2 + rr * s),
                     outline=(245, 197, 24, alpha), width=max(2, round(10 * s)))
    draw.ellipse((size / 2 - 560 * s, size / 2 - 560 * s, size / 2 + 560 * s, size / 2 + 560 * s),
                 fill=(255, 249, 232, 255))
    d = fit(dino, round(760 * s), round(920 * s))
    paste_center(base, d, round(size / 2), round(size * 0.46))
    title = "广告设计师三级"
    subtitle = "全库随机抽题 · 完全离线"
    f1, f2 = font(round(92 * s)), font(round(38 * s), bold=False)
    tw = draw.textlength(title, font=f1)
    draw.text(((size - tw) / 2, round(size * 0.72)), title, font=f1, fill=INK)
    tw2 = draw.textlength(subtitle, font=f2)
    draw.text(((size - tw2) / 2, round(size * 0.78)), subtitle, font=f2, fill=(122, 110, 82))
    return base


def write_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"找不到源图片：{SOURCE}\n请把黄色小恐龙图片命名为 1.jpg 放到 input 目录。")
    ASSETS.mkdir(parents=True, exist_ok=True)
    WWW_ASSETS.mkdir(parents=True, exist_ok=True)

    dino = remove_white(SOURCE)
    dino.save(ASSETS / "dino-cutout.png")
    fit(dino, 720, 900).save(WWW_ASSETS / "dino.webp", "WEBP", quality=88, method=6)

    full = icon_full(dino)
    write_png(full, ASSETS / "icon.png")
    write_png(icon_round(dino), ASSETS / "icon-round.png")
    write_png(icon_foreground(dino), ASSETS / "icon-foreground.png")
    write_png(icon_background(), ASSETS / "icon-background.png")
    write_png(splash(dino), ASSETS / "splash.png")

    # PWA assets
    write_png(full.resize((512, 512), Image.LANCZOS), WWW_ASSETS / "icon-512.png")
    write_png(full.resize((192, 192), Image.LANCZOS), WWW_ASSETS / "icon-192.png")
    write_png(full.resize((180, 180), Image.LANCZOS), WWW_ASSETS / "apple-touch-icon.png")
    write_png(full.resize((64, 64), Image.LANCZOS), WWW_ASSETS / "favicon.png")
    maskable = full.copy()
    write_png(maskable.resize((512, 512), Image.LANCZOS), WWW_ASSETS / "icon-maskable-512.png")

    # Android legacy + adaptive icon densities
    densities = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
    for name, scale in densities.items():
        folder = ASSETS / "android" / f"mipmap-{name}"
        folder.mkdir(parents=True, exist_ok=True)
        for src, filename, dp in ((full, "ic_launcher.png", 48), (icon_round(dino), "ic_launcher_round.png", 48),
                                  (icon_foreground(dino), "ic_launcher_foreground.png", 108)):
            px = round(dp * scale)
            write_png(src.resize((px, px), Image.LANCZOS), folder / filename)

    # iOS AppIcon set
    ios_icons = {
        "Icon-20@2x.png": 40, "Icon-20@3x.png": 60,
        "Icon-29@2x.png": 58, "Icon-29@3x.png": 87,
        "Icon-40@2x.png": 80, "Icon-40@3x.png": 120,
        "Icon-60@2x.png": 120, "Icon-60@3x.png": 180,
        "Icon-20.png": 20, "Icon-29.png": 29, "Icon-40.png": 40,
        "Icon-76.png": 76, "Icon-76@2x.png": 152, "Icon-83.5@2x.png": 167,
        "Icon-1024.png": 1024,
    }
    appicon = ASSETS / "ios" / "AppIcon.appiconset"
    appicon.mkdir(parents=True, exist_ok=True)
    ios_icon = full.convert("RGB")  # App Store icons must not carry an alpha channel.
    for filename, px in ios_icons.items():
        write_png(ios_icon.resize((px, px), Image.LANCZOS), appicon / filename)

    contents = {
        "images": [
            {"size": "20x20", "idiom": "iphone", "filename": "Icon-20@2x.png", "scale": "2x"},
            {"size": "20x20", "idiom": "iphone", "filename": "Icon-20@3x.png", "scale": "3x"},
            {"size": "29x29", "idiom": "iphone", "filename": "Icon-29@2x.png", "scale": "2x"},
            {"size": "29x29", "idiom": "iphone", "filename": "Icon-29@3x.png", "scale": "3x"},
            {"size": "40x40", "idiom": "iphone", "filename": "Icon-40@2x.png", "scale": "2x"},
            {"size": "40x40", "idiom": "iphone", "filename": "Icon-40@3x.png", "scale": "3x"},
            {"size": "60x60", "idiom": "iphone", "filename": "Icon-60@2x.png", "scale": "2x"},
            {"size": "60x60", "idiom": "iphone", "filename": "Icon-60@3x.png", "scale": "3x"},
            {"size": "20x20", "idiom": "ipad", "filename": "Icon-20.png", "scale": "1x"},
            {"size": "20x20", "idiom": "ipad", "filename": "Icon-20@2x.png", "scale": "2x"},
            {"size": "29x29", "idiom": "ipad", "filename": "Icon-29.png", "scale": "1x"},
            {"size": "29x29", "idiom": "ipad", "filename": "Icon-29@2x.png", "scale": "2x"},
            {"size": "40x40", "idiom": "ipad", "filename": "Icon-40.png", "scale": "1x"},
            {"size": "40x40", "idiom": "ipad", "filename": "Icon-40@2x.png", "scale": "2x"},
            {"size": "76x76", "idiom": "ipad", "filename": "Icon-76.png", "scale": "1x"},
            {"size": "76x76", "idiom": "ipad", "filename": "Icon-76@2x.png", "scale": "2x"},
            {"size": "83.5x83.5", "idiom": "ipad", "filename": "Icon-83.5@2x.png", "scale": "2x"},
            {"size": "1024x1024", "idiom": "ios-marketing", "filename": "Icon-1024.png", "scale": "1x"},
        ],
        "info": {"version": 1, "author": "xcode"},
    }
    (appicon / "Contents.json").write_text(json.dumps(contents, ensure_ascii=False, indent=2), "utf8")

    # iOS Splash.imageset (Capacitor uses a single 2732 universal image)
    splash_set = ASSETS / "ios" / "Splash.imageset"
    splash_set.mkdir(parents=True, exist_ok=True)
    splash_img = splash(dino)
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        write_png(splash_img, splash_set / name)
    (splash_set / "Contents.json").write_text(json.dumps({
        "images": [
            {"filename": "splash-2732x2732.png", "idiom": "universal", "scale": "1x"},
            {"filename": "splash-2732x2732-1.png", "idiom": "universal", "scale": "2x"},
            {"filename": "splash-2732x2732-2.png", "idiom": "universal", "scale": "3x"},
        ],
        "info": {"version": 1, "author": "xcode"},
    }, ensure_ascii=False, indent=2), "utf8")

    print(f"图标已生成：{ASSETS}")
    print(f"PWA 图标已生成：{WWW_ASSETS}")
    print(f"恐龙抠图尺寸：{dino.size}")


if __name__ == "__main__":
    main()
