"""Reproducible map pictograms, shared by web and native renderers.

The traffic light is colored (dark housing with red, amber and green lamps); the police shield has
a navy star cut out. Both are drawn at 4x and reduced so they stay crisp at small marker sizes.
The others are white.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

target = Path(__file__).resolve().parents[1] / 'apps/mobile/public/map-icons'
target.mkdir(parents=True, exist_ok=True)


def traffic_light() -> Image.Image:
    size = 256
    im = Image.new('RGBA', (size, size)); d = ImageDraw.Draw(im)
    # Housing: near-black body with a white rim, so it stands out on the dark marker bubble.
    d.rounded_rectangle((70, 14, 186, 242), radius=40, fill=(11, 18, 32, 255),
                        outline=(255, 255, 255, 255), width=12)
    lamps = [(64, (255, 77, 77)), (128, (255, 194, 51)), (192, (46, 229, 122))]
    for y, color in lamps:
        d.ellipse((98, y - 30, 158, y + 30), fill=(*color, 255))
        # Small highlight gives the lamp a lit, glassy look.
        d.ellipse((110, y - 20, 126, y - 4), fill=(255, 255, 255, 150))
    return im.resize((64, 64), Image.Resampling.LANCZOS)


def police() -> Image.Image:
    """Badge shield with a star: a police station, white on the navy marker."""
    size = 256
    im = Image.new('RGBA', (size, size)); d = ImageDraw.Draw(im); white = (255, 255, 255, 255)
    d.polygon([(128, 18), (214, 50), (204, 150), (128, 238), (52, 150), (42, 50)], fill=white)
    navy = (30, 58, 138, 255)
    points = []
    for i in range(10):
        radius = 52 if i % 2 == 0 else 22
        angle = -math.pi / 2 + i * math.pi / 5
        points.append((128 + radius * math.cos(angle), 118 + radius * math.sin(angle)))
    d.polygon(points, fill=navy)
    return im.resize((64, 64), Image.Resampling.LANCZOS)


def hospital() -> Image.Image:
    """Bold medical cross, white on the green marker."""
    size = 256
    im = Image.new('RGBA', (size, size)); d = ImageDraw.Draw(im); white = (255, 255, 255, 255)
    d.rounded_rectangle((98, 30, 158, 226), radius=14, fill=white)
    d.rounded_rectangle((30, 98, 226, 158), radius=14, fill=white)
    return im.resize((64, 64), Image.Resampling.LANCZOS)


for name in ['signals', 'police', 'health']:
    {'signals': traffic_light, 'police': police, 'health': hospital}[name]().save(
        target / f'{name}.png')

for name in ['sidewalks', 'accessibility', 'lighting', 'floods', 'reports', 'history']:
    im = Image.new('RGBA', (128, 128)); d = ImageDraw.Draw(im); white = (255,255,255,255)
    def line(points, width=7): d.line(points, fill=white, width=width, joint='curve')
    def ellipse(box, width=6): d.ellipse(box, outline=white, width=width)
    if name == 'sidewalks':
        line([(23,18),(23,112)]); line([(104,18),(104,112)])
        for y in [24,56,88]: d.rectangle((39,y,88,y+18),outline=white,width=5)
    elif name == 'accessibility':
        d.ellipse((56,10,74,28),fill=white); line([(62,36),(58,66),(91,66),(107,95)])
        line([(59,47),(88,47)]); d.arc((24,48,84,113),40,305,fill=white,width=7)
    elif name == 'lighting':
        ellipse((34,14,94,74)); line([(43,66),(48,91),(80,91),(85,66)])
        line([(49,105),(79,105)])
        for a,b in [((64,0),(64,6)),((11,44),(22,44)),((106,44),(117,44)),((20,7),(30,17)),((98,17),(108,7))]: line([a,b],5)
    elif name == 'floods':
        for y in [38,65,92]: line([(12,y),(30,y-9),(48,y),(66,y-9),(84,y),(102,y-9),(116,y)],6)
    elif name == 'reports':
        line([(64,13),(115,108),(13,108),(64,13)],7); line([(64,44),(64,76)],8)
        d.ellipse((59,88,69,98),fill=white)
    else:
        ellipse((17,17,111,111)); line([(64,35),(64,66),(87,80)],7)
    im.resize((64,64),Image.Resampling.LANCZOS).save(target / f'{name}.png')
