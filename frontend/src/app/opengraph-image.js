import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';

export const alt = "Aux P'tits Pois — AMAP à Clamart, un panier bio et local chaque semaine";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

/* Le moteur de rendu ne lit ni les WOFF2 servis par next/font ni le WebP du
   hero : public/fonts et public/og hébergent les dérivés TTF et JPEG. */
const asset = name => readFile(path.join(process.cwd(), 'public', name));

const dataUri = (buffer, mime) => `data:${mime};base64,${buffer.toString('base64')}`;

const STATS = [
  { value: '0', label: 'intermédiaire entre la ferme et le panier' },
  { value: '49', label: 'semaines de distribution par an' },
  { value: '−80 %', label: 'tarif solidaire avec le Secours Catholique' },
];

export default async function OpengraphImage() {
  const [frauncesItalic, fraunces, jakarta, geistMono, panier, logo] = await Promise.all([
    asset('fonts/fraunces-italic-300.ttf'),
    asset('fonts/fraunces-400.ttf'),
    asset('fonts/jakarta-400.ttf'),
    asset('fonts/geist-mono-500.ttf'),
    asset('og/panier.jpg'),
    asset('og/logo.png'),
  ]);

  const rendered = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#FAF7F2',
          fontFamily: 'Jakarta',
        }}
      >
        <div
          style={{
            width: 780,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '54px 44px 54px 68px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src={dataUri(logo, 'image/png')} width={50} height={50} alt="" />
            <span
              style={{
                marginLeft: 12,
                fontFamily: 'Fraunces',
                fontSize: 26,
                letterSpacing: '-0.01em',
                color: '#1F2421',
              }}
            >
              Aux P’tits Pois
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                alignSelf: 'flex-start',
                padding: '9px 18px 9px 15px',
                marginBottom: 28,
                backgroundColor: '#F3EDE3',
                border: '1px solid #E3DCD0',
                borderRadius: 999,
              }}
            >
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  backgroundColor: '#83AB44',
                }}
              />
              <span
                style={{
                  marginLeft: 11,
                  fontFamily: 'GeistMono',
                  fontSize: 16,
                  letterSpacing: '0.1em',
                  color: '#4A5148',
                }}
              >
                DISTRIBUTION MERCREDI 18H15
              </span>
            </div>

            <div
              style={{
                fontFamily: 'FrauncesItalic',
                fontSize: 66,
                lineHeight: 1.03,
                letterSpacing: '-0.025em',
                color: '#1F2421',
              }}
            >
              Un panier bio et local, chaque semaine à Clamart.
            </div>
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid #E7DFD3', paddingTop: 22 }}>
            {STATS.map((stat, index) => (
              <div
                key={stat.value}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: 222,
                  paddingLeft: index === 0 ? 0 : 22,
                  borderLeft: index === 0 ? 'none' : '1px solid #E7DFD3',
                }}
              >
                <span style={{ fontFamily: 'GeistMono', fontSize: 30, color: '#8F5F37' }}>
                  {stat.value}
                </span>
                <span
                  style={{
                    marginTop: 7,
                    fontSize: 15,
                    lineHeight: 1.4,
                    color: '#8A8B80',
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', width: 420, borderLeft: '1px solid #E7DFD3' }}>
          <img
            src={dataUri(panier, 'image/jpeg')}
            width={420}
            height={630}
            style={{ objectFit: 'cover' }}
            alt=""
          />
        </div>
      </div>
    ),
    {
      ...size,
      /* Une graisse par nom de famille : deux fontes sous le même nom laissent
         le moteur choisir, et il retombe sur le romain. */
      fonts: [
        { name: 'FrauncesItalic', data: frauncesItalic, weight: 400, style: 'normal' },
        { name: 'Fraunces', data: fraunces, weight: 400, style: 'normal' },
        { name: 'Jakarta', data: jakarta, weight: 400, style: 'normal' },
        { name: 'GeistMono', data: geistMono, weight: 500, style: 'normal' },
      ],
    }
  );

  /* Le moteur ne sort que du PNG, soit 700 ko une fois la photo dedans. Le JPEG
     rend la même image en 116 ko, sans sous-échantillonnage de chrominance pour
     garder le texte net sur les aplats crème. */
  const jpeg = await sharp(Buffer.from(await rendered.arrayBuffer()))
    .jpeg({ quality: 82, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();

  return new Response(jpeg, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
