from pathlib import Path
import sys
from PIL import Image

frames_dir = Path(sys.argv[1])
output = Path(sys.argv[2])
paths = sorted(frames_dir.glob('frame-*.png'))
if len(paths) != 180:
    raise SystemExit(f'Expected exactly 180 frames, found {len(paths)}.')
frames = [Image.open(path).convert('RGB') for path in paths]
if any(frame.size != (800, 600) for frame in frames):
    raise SystemExit('Every frame must be 800 x 600 pixels.')
durations = [34 if index % 3 == 2 else 33 for index in range(180)]
output.parent.mkdir(parents=True, exist_ok=True)
frames[0].save(
    output,
    format='WEBP',
    save_all=True,
    append_images=frames[1:],
    duration=durations,
    loop=0,
    quality=88,
    method=6,
)

# Pillow exposes the loop and frame count, but does not report per-frame WebP
# durations on decode. Read the ANMF frame headers to verify the 6-second loop.
data = output.read_bytes()
offset = 12
encoded_durations = []
while offset + 8 <= len(data):
    tag = data[offset:offset + 4]
    length = int.from_bytes(data[offset + 4:offset + 8], 'little')
    chunk = data[offset + 8:offset + 8 + length]
    if tag == b'ANMF':
        encoded_durations.append(int.from_bytes(chunk[12:15], 'little'))
    offset += 8 + length + (length & 1)
if len(encoded_durations) != 180 or sum(encoded_durations) != 6000:
    raise SystemExit(f'Expected 180 WebP frames totaling 6000 ms; found {len(encoded_durations)} totaling {sum(encoded_durations)} ms.')
print(f'Encoded {len(frames)} frames over {sum(encoded_durations)} ms into {output} ({output.stat().st_size:,} bytes).')
