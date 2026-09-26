import random, math
from datetime import date
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

F = "/usr/share/fonts/truetype/dejavu/"
def font(name, size): return ImageFont.truetype(name, size)
SANS = lambda s: font(F+"DejaVuSans.ttf", s)
SANSB = lambda s: font(F+"DejaVuSans-Bold.ttf", s)
SERIFB = lambda s: font(F+"DejaVuSerif-Bold.ttf", s)
MONO = lambda s: font(F+"DejaVuSansMono.ttf", s)
import os
HAND = [os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", n) for n in ("Kalam-Regular.ttf", "Caveat-Variable.ttf")]

MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
def fmt_date(iso, style):
    d = date.fromisoformat(iso)
    return {"dmy": f"{d.day:02d}/{d.month:02d}/{d.year}", "dmy_slash": f"{d.day:02d}/{d.month:02d}/{d.year}",
            "dmy_short": f"{d.day:02d}/{d.month:02d}/{d.year%100:02d}", "dmon": f"{d.day:02d}-{MON[d.month-1]}-{d.year}",
            "dot": f"{d.day}.{d.month}.{d.year%100:02d}", "print": f"{d.day:02d}-{MON[d.month-1]}-{d.year}"}[style]

def fmt_km(km, style):
    if style == "k": return f"{km/1000:.1f}k"
    if style == "km": return f"{km} km"
    return f"{km:,}"

def watermark(img):
    d = ImageDraw.Draw(img)
    d.text((14, img.height-26), "SYNTHETIC TEST DATA - PaperTrail - not a real document", font=SANS(14), fill=(150,150,150))
    return img

def hand(draw, xy, text, rng, size=30, ink=(25,45,150), hfont=None):
    f = ImageFont.truetype(hfont or HAND[0], size)
    x, y = xy
    for ch in text:  # per-character jitter for handwriting feel
        draw.text((x, y + rng.uniform(-1.8, 1.8)), ch, font=f, fill=ink)
        x += draw.textlength(ch, font=f) * rng.uniform(0.93, 1.05)
    return x

def stamp(img, center, text, rng, color=(110,40,140)):
    w, h = 250, 110
    s = Image.new("RGBA", (w, h), (0,0,0,0)); d = ImageDraw.Draw(s)
    d.ellipse([4,4,w-4,h-4], outline=color+(170,), width=4)
    d.ellipse([14,14,w-14,h-14], outline=color+(140,), width=2)
    words = text.split(",")[0][:24]
    tw = d.textlength(words, font=SANSB(15)); d.text(((w-tw)/2, 36), words, font=SANSB(15), fill=color+(170,))
    tw = d.textlength("AUTHORISED SERVICE", font=SANS(12)); d.text(((w-tw)/2, 60), "AUTHORISED SERVICE", font=SANS(12), fill=color+(150,))
    s = s.rotate(rng.uniform(-18, 18), expand=True, resample=Image.BICUBIC)
    img.alpha_composite(s, (int(center[0]-s.width/2), int(center[1]-s.height/2)))

# ---------------- RC (smart-card style, front + back on one image) ----------------
def render_rc(rc, rng):
    W, H = 1400, 1000
    img = Image.new("RGBA", (W, H), (238,236,230,255)); d = ImageDraw.Draw(img)
    def card(x0, y0, title):
        d.rounded_rectangle([x0, y0, x0+1300, y0+440], 26, fill=(226,238,246), outline=(90,120,150), width=3)
        d.rectangle([x0+3, y0+3, x0+1297, y0+62], fill=(40,80,130))
        d.text((x0+24, y0+14), title, font=SANSB(26), fill="white")
        d.text((x0+1050, y0+20), "Form 23A (Specimen)", font=SANS(18), fill=(220,230,245))
    card(50, 40, "CERTIFICATE OF REGISTRATION  —  STATE TRANSPORT DEPT")
    fr = [("Regn. Number", rc["reg"]), ("Date of Regn.", fmt_date(rc["reg_date"], "print")),
          ("Regn. Validity", fmt_date(str(int(rc["reg_date"][:4])+15)+rc["reg_date"][4:], "print")),
          ("Chassis Number", rc["chassis"]), ("Engine / Motor No.", rc["engine"]),
          ("Owner Name", rc["owner"].upper()), ("Owner Serial No.", str(rc["owner_serial"])),
          ("Fuel", rc["fuel"].upper())]
    y = 125
    for i, (k, v) in enumerate(fr):
        x = 90 if i % 2 == 0 else 720
        d.text((x, y), k, font=SANS(19), fill=(70,90,110)); d.text((x, y+24), v, font=MONO(28) if "No" in k or "Number" in k else SANSB(26), fill=(15,20,30))
        if i % 2 == 1: y += 72
    card(50, 520, "VEHICLE PARTICULARS  (REVERSE)")
    br = [("Maker's Name", rc["maker"]), ("Model Name", rc["model"]), ("Colour", rc["colour"]),
          ("Month / Yr of Mfg.", rc["mfg"]), ("Body Type", "SALOON / MUV"), ("Seating Capacity", "5" if "Innova" not in rc["model"] and "Ertiga" not in rc["model"] else "7"),
          ("Financier", rc["financier"]), ("Emission Norms", "BHARAT STAGE VI" if int(rc["reg_date"][:4]) >= 2020 else "BHARAT STAGE IV")]
    y = 605
    for i, (k, v) in enumerate(br):
        x = 90 if i % 2 == 0 else 720
        d.text((x, y), k, font=SANS(19), fill=(70,90,110)); d.text((x, y+24), v.upper(), font=SANSB(24), fill=(15,20,30))
        if i % 2 == 1: y += 72
    return watermark(img)

# ---------------- Service book pages ----------------
def render_service_page(page_no, rows, book, rc, rng, show_header, date_default):
    W, H = 1100, 1500
    img = Image.new("RGBA", (W, H), (246,240,222,255)); d = ImageDraw.Draw(img)
    for _ in range(4000):  # paper speckle
        x, y = rng.randrange(W), rng.randrange(H); c = rng.randint(215, 235)
        d.point((x, y), fill=(c, c-6, c-20))
    d.text((60, 40), "PERIODIC MAINTENANCE RECORD", font=SERIFB(36), fill=(60,40,30))
    d.text((W-200, 50), f"Page {page_no}", font=SANS(22), fill=(90,70,60))
    top = 110
    if show_header:
        d.rectangle([60, top, W-60, top+220], outline=(90,70,60), width=2)
        labels = [("Regn. No.", book["reg"]), ("Chassis No.", book["chassis"]),
                  ("Model", rc["model"]), ("Date of Sale", fmt_date(book["sale_date"], date_default))]
        for i, (k, v) in enumerate(labels):
            yy = top + 18 + i*50
            d.text((80, yy+6), k + " :", font=SANS(22), fill=(80,60,50))
            d.line([(260, yy+40), (W-90, yy+40)], fill=(160,140,120), width=1)
            hand(d, (275, yy-4), v, rng, size=34)
        top += 250
    cols = [("Sr", 60), ("Date", 150), ("KMs", 320), ("Type of Service", 470), ("Dealer / Job Card", 700), ("Stamp & Sign", 900)]
    d.rectangle([60, top, W-60, top+50], fill=(225,212,185), outline=(90,70,60), width=2)
    for name, x in cols:
        d.text((x+8, top+12), name, font=SANSB(19), fill=(60,40,30))
        d.line([(x, top), (x, H-120)], fill=(90,70,60), width=2)
    d.line([(W-60, top), (W-60, H-120)], fill=(90,70,60), width=2)
    row_h = (H-120-top-50) // 5
    for r in range(6): d.line([(60, top+50+r*row_h), (W-60, top+50+r*row_h)], fill=(90,70,60), width=2)
    hfont = HAND[0]
    for i, e in enumerate(rows):
        y = top + 50 + i*row_h
        ex = e.get("extra", {})
        d.text((72, y+20), str(e["sr"]), font=SANS(22), fill=(60,40,30))
        if e["date"]: hand(d, (158, y+14), fmt_date(e["date"], ex.get("fmt", date_default)), rng, 30, hfont=hfont)
        if e["km"] is not None:
            kx0 = 328; kx1 = hand(d, (kx0, y+14), fmt_km(e["km"], ex.get("km_style")), rng, 32, hfont=hfont)
            if ex.get("blot"):
                blob = Image.new("RGBA", (W, H), (0,0,0,0)); bd = ImageDraw.Draw(blob)
                cx, cy = kx0 + (kx1-kx0)*0.5, y+38
                for _ in range(40):
                    rr = rng.uniform(8, 26); rr = min(rr, 22); ox, oy = rng.uniform(-(kx1-kx0)*0.5+rr, (kx1-kx0)*0.5-rr+6), rng.uniform(-14, 14)
                    bd.ellipse([cx+ox-rr, cy+oy-rr, cx+ox+rr, cy+oy+rr], fill=(20,30,110,235))
                blob = blob.filter(ImageFilter.GaussianBlur(2)); img.alpha_composite(blob); d = ImageDraw.Draw(img)
        st = e["type"]; words = st.split(); line1 = " ".join(words[:2]); line2 = " ".join(words[2:])
        hand(d, (478, y+10), line1, rng, 27, hfont=hfont)
        if line2: hand(d, (478, y+46), line2, rng, 27, hfont=hfont)
        dealer = e["dealer"].split(",")[0]
        d.text((708, y+14), dealer[:20], font=SANS(15), fill=(40,40,40))
        d.text((708, y+36), dealer[20:40], font=SANS(15), fill=(40,40,40))
        if e["date"]: d.text((708, y+62), f"JC/{e['date'][2:4]}/{rng.randint(1000,9999)}", font=MONO(16), fill=(40,40,40))
        if ex.get("note"):
            d.text((478, y+row_h-44), "", font=SANS(10))
            hand(d, (75, y+row_h-44), "Note: " + ex["note"], rng, 19, ink=(150,20,20), hfont=hfont)
        stamp(img, (1000, y+row_h/2), e["dealer"], rng); d = ImageDraw.Draw(img)
        hand(d, (935, y+row_h-60), "~" + e["dealer"][0] + "." + rng.choice("KRSMP"), rng, 30, ink=(20,20,20), hfont=HAND[1])
    return watermark(img)

# ---------------- Insurance schedule ----------------
def render_insurance(p, rc, rng):
    W, H = 1240, 1650
    img = Image.new("RGBA", (W, H), (255,255,255,255)); d = ImageDraw.Draw(img)
    d.rectangle([0,0,W,120], fill=(20,95,90)); d.text((50, 25), p["insurer"], font=SANSB(34), fill="white")
    d.text((50, 75), "Private Car Package Policy — Certificate of Insurance cum Policy Schedule", font=SANS(20), fill=(210,240,235))
    rows = [("Policy Number", p["policy_number"]), ("Period of Insurance",
             f"From 00:00 hrs on {fmt_date(p['start'],'print')} To Midnight of {fmt_date(p['end'],'print')}"),
            ("Insured Name", rc["owner"]), ("Registration No.", rc["reg"]), ("Chassis No.", rc["chassis"]),
            ("Engine No.", rc["engine"]), ("Make / Model", f"{rc['maker'].split()[0]} / {rc['model']}"),
            ("Year of Manufacture", rc["mfg"][-4:]), ("Insured Declared Value (IDV)", f"Rs. {rng.randint(3,12)*50000 + rng.randint(0,49)*1000:,}"),
            ("No Claim Bonus", f"{p['ncb_percent']}%"), ("Previous Policy No.", p.get("prev") or "—")]
    y = 170
    for k, v in rows:
        d.rectangle([50, y, W-50, y+62], outline=(180,190,190), width=1)
        d.rectangle([50, y, 420, y+62], fill=(236,244,243))
        d.text((66, y+18), k, font=SANSB(20), fill=(30,60,60)); d.text((440, y+18), v, font=SANS(20), fill=(10,10,10))
        y += 62
    y += 40
    d.text((50, y), "Premium Details", font=SANSB(24), fill=(20,95,90)); y += 44
    od, tp = rng.randint(6000, 19000), 3416
    for k, v in [("Own Damage Premium", od), ("Liability (TP) Premium", tp), ("GST @18%", round((od+tp)*0.18)), ("Total Premium", round((od+tp)*1.18))]:
        d.text((66, y), k, font=SANS(20), fill=(30,30,30)); d.text((W-300, y), f"Rs. {v:,}", font=MONO(20), fill=(30,30,30)); y += 36
    d.text((50, H-160), "This is a computer generated document. Subject to IMT endorsements and policy wordings.", font=SANS(16), fill=(110,110,110))
    return watermark(img)

# ---------------- "Phone photo" augmentation ----------------
def photo(img, rng, ops=()):
    img = img.convert("RGB")
    bg = Image.new("RGB", (int(img.width*1.18), int(img.height*1.14)), tuple(rng.randint(70, 130) for _ in range(3)))
    bg.paste(img, ((bg.width-img.width)//2, (bg.height-img.height)//2))
    img = bg.rotate(rng.uniform(-3.5, 3.5), resample=Image.BICUBIC, fillcolor=bg.getpixel((2,2)))
    # lighting gradient (shadow from one side)
    grad = Image.linear_gradient("L").rotate(rng.choice([0, 90, 180, 270])).resize(img.size)
    dark = ImageEnhance.Brightness(img).enhance(0.72)
    img = Image.composite(img, dark, grad.point(lambda v: 110 + v*145//255))
    if "blur" in ops: img = img.filter(ImageFilter.GaussianBlur(2.2))
    else: img = img.filter(ImageFilter.GaussianBlur(0.6))
    if "rotate90" in ops: img = img.rotate(90, expand=True)
    img.thumbnail((1600, 1600))
    return img
