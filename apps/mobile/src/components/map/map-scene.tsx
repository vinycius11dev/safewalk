import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/theme-provider';
import { mapStyles } from './map-scene.styles';

export function MapScene({
  variant = 'home',
  step = 0,
  adaptive = true,
  focusTop = false,
}: {
  variant?: 'home' | 'routes' | 'trip';
  step?: number;
  adaptive?: boolean;
  focusTop?: boolean;
}) {
  const [canvasHeight, setCanvasHeight] = useState(844);
  const { colors: c } = useTheme();
  const route = variant !== 'home';
  const userY = variant === 'trip' ? 560 + Math.min(step, 4) * 25 : 400;
  const compactBy = adaptive && route ? Math.max(0, 844 - canvasHeight) : 0;
  const scale =
    adaptive && variant === 'routes' ? Math.min(1, Math.max(0.55, (canvasHeight - 524) / 255)) : 1;
  // Keep the traveler above the tracking sheet, including shorter browser windows.
  const rotatedUserY = 422 + 95 * 0.5 + (userY - 422) * Math.cos(Math.PI / 6) - 180;
  const shift =
    focusTop && variant === 'trip'
      ? rotatedUserY - Math.max(110, Math.min(220, canvasHeight * 0.22))
      : compactBy * (variant === 'routes' ? 0.6 : 0.7);
  return (
    <View
      pointerEvents="none"
      style={mapStyles.map}
      onLayout={(event) => setCanvasHeight(event.nativeEvent.layout.height)}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMin slice"
        accessibilityLabel="Mapa ilustrativo da Bela Vista. Dados de demonstração."
        style={mapStyles.svg}
      >
        <Rect width="390" height="844" fill={c.background} />
        <G transform={`translate(195 ${332 - shift}) scale(${scale}) translate(-195 -332)`}>
          <G
            transform={
              variant === 'routes'
                ? 'translate(0 -245) rotate(-30 195 422)'
                : variant === 'trip'
                  ? 'translate(0 -180) rotate(-30 195 422)'
                  : 'translate(0 -170) rotate(-30 195 422)'
            }
          >
            <Rect x="300" y="290" width="110" height="100" rx="6" fill={c.mapPark} />
            <Rect x="-90" y="610" width="80" height="80" rx="6" fill={c.mapPark} />
            <Path
              d="M-700 150H1100M-700 250H1100M-700 350H1100M-700 450H1100M-700 550H1100M-700 650H1100M-700 750H1100M-700 850H1100"
              stroke={c.mapRoad}
              strokeWidth="3"
            />
            <Path
              d="M-700 -300H1100M-700 -200H1100M-700 -100H1100M-700 0H1100M-700 100H1100M-700 200H1100M-700 300H1100M-700 500H1100M-700 600H1100M-700 700H1100M-700 800H1100M-700 900H1100M-700 1000H1100M-700 1100H1100M-700 1200H1100"
              stroke={c.mapRoad}
              strokeWidth="7"
            />
            <Path
              d="M-600 -600V1500M-500 -600V1500M-400 -600V1500M-300 -600V1500M-200 -600V1500M-100 -600V1500M0 -600V1500M300 -600V1500M400 -600V1500M500 -600V1500M600 -600V1500M700 -600V1500M800 -600V1500M900 -600V1500M1000 -600V1500"
              stroke={c.mapRoad}
              strokeWidth="7"
            />
            <Path d="M100 -600V1500M200 -600V1500" stroke={c.mapRoad} strokeWidth="10" />
            <Path d="M-700 400H1100" stroke={c.mapAvenue} strokeWidth="16" />
            <SvgText
              x="235"
              y="404"
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.5"
              fill={c.muted}
            >
              AV. PAULISTA
            </SvgText>
            <SvgText
              transform="translate(96 250) rotate(90)"
              fontSize="9"
              fontWeight="600"
              fill={c.muted}
            >
              R. AUGUSTA
            </SvgText>
            <SvgText
              transform="translate(196 760) rotate(90)"
              fontSize="9"
              fontWeight="600"
              fill={c.muted}
            >
              R. FREI CANECA
            </SvgText>
            {!route && (
              <SvgText x="316" y="346" fontSize="9" fontWeight="600" fill={c.success}>
                Parque Trianon
              </SvgText>
            )}
            {route && (
              <>
                {variant === 'routes' && (
                  <>
                    <Path
                      d="M100 400H200V650"
                      stroke="#3A4560"
                      strokeWidth="11"
                      fill="none"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M100 400H200V650"
                      stroke="#5B6886"
                      strokeWidth="6"
                      fill="none"
                      strokeLinejoin="round"
                    />
                  </>
                )}
                {variant === 'trip' && (
                  <Path
                    d="M100 400V560"
                    stroke="#5B6886"
                    strokeWidth="6"
                    strokeDasharray="2 8"
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
                <Path
                  d={variant === 'trip' ? 'M100 560V700H200V650' : 'M100 400V700H200V650'}
                  stroke="#1A3F8C"
                  strokeWidth="11"
                  fill="none"
                  strokeLinejoin="round"
                />
                <Path
                  d={variant === 'trip' ? 'M100 560V700H200V650' : 'M100 400V700H200V650'}
                  stroke="#4C8DFF"
                  strokeWidth="6"
                  fill="none"
                  strokeLinejoin="round"
                />
                {[
                  { x: 100, y: 520 },
                  { x: 100, y: 640 },
                  { x: 160, y: 700 },
                ].map((point) => (
                  <G key={point.y} transform={`translate(${point.x} ${point.y}) rotate(30)`}>
                    <Circle r="10" fill={c.surface} stroke="#4C8DFF" strokeWidth="2.5" />
                    <Rect x="-5" y="-3" width="7" height="6" rx="1.2" fill="#4C8DFF" />
                    <Path d="M2 -1.5L5 -3V3L2 1.5Z" fill="#4C8DFF" />
                  </G>
                ))}
                {variant === 'routes' && (
                  <G transform="translate(100 465) rotate(30)">
                    <Circle r="10" fill={c.success} stroke={c.background} strokeWidth="3" />
                    <Path
                      d="M-4 0.5L-1 3.5L4 -2.5"
                      stroke={c.background}
                      strokeWidth="2.2"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </G>
                )}
                <G transform="translate(200 650) rotate(30)">
                  <Path
                    d="M0 0c-6-8-12-13-12-20a12 12 0 0124 0c0 7-6 12-12 20z"
                    fill="#FF6B6B"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <Circle cy="-20" r="4.5" fill="#FFFFFF" />
                </G>
              </>
            )}
            {(route
              ? [
                  { x: 150, y: 400, color: c.danger },
                  { x: 200, y: 520, color: c.warning },
                ]
              : [
                  { x: 180, y: 340, color: c.danger },
                  { x: 60, y: 330, color: c.danger },
                  { x: 300, y: 500, color: c.warning },
                ]
            ).map((point, i) => (
              <G key={i} transform={`translate(${point.x} ${point.y}) rotate(30)`}>
                <Circle r="11" fill={point.color} stroke={c.background} strokeWidth="3" />
                <Path
                  d="M0 -5V1M0 4.5V5"
                  stroke={c.background}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </G>
            ))}
            <Circle cx="100" cy={userY} r="26" fill="#4C8DFF33" />
            <Circle cx="100" cy={userY} r="9" fill="#4C8DFF" stroke="#FFFFFF" strokeWidth="3" />
          </G>
        </G>
      </Svg>
    </View>
  );
}
