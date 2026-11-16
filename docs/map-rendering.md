# Mapa real: renderização e limites

`RealMap` substitui a ilustração SVG com coordenadas e tiles vetoriais reais. O componente não solicita GPS nem calcula segurança. A centralização inicial na FIAP Paulista é uma referência de câmera, sem alegar que o usuário está naquele ponto.

## Implementação

- Web: MapLibre GL JS **6.16.0**, carregado somente pelo adaptador `.web.tsx`. CSS do navegador em arquivos separados.
- Android/iOS: `@maplibre/maplibre-react-native` **11.5.0**, componente nativo `Map`, `Camera`, `GeoJSONSource` e `Layer` da API v11. Sem WebView. Compatibilidade declarada pelo pacote: Expo >=54, React Native >=0.80 e React >=19.1; projeto usa Expo58/RN0.88/React19.3.
- Estilo local `real-map.map-style.ts`, usando os tokens claro/escuro SafeWalk: fundo navy, ruas discretas, rótulos, água e parques. A geometria real não reproduz os traçados inventados do protótipo.
- 2D/3D altera a inclinação real da câmera. Extrusão usa `render_height`/`render_min_height` existentes nos dados OpenMapTiles, a partir do zoom15. Ausência de altura não cria edifícios fictícios. Isso não é fotogrametria, imagem de satélite nem garantia de altura medida.
- Rotas são GeoJSON LineString recebidas da API; o mapa não inventa caminhos em linha reta. Camadas urbanas preservam Point/MultiPoint, LineString/MultiLineString e Polygon/MultiPolygon. Cores de camada indicam categoria, sem pontuar risco. Histórico e suscetibilidade de inundação usam cor neutra e opacidade menor que registros ativos.
- Falhas de rede/WebGL mostram estado explícito e tentativa novamente; não fazem fallback silencioso para mapa de demonstração.

## Provedor público

Fonte vetorial: `https://tiles.openfreemap.org/planet`; glyphs: `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`. Não há chave, cadastro nem serviço pago nesta integração. Atribuição OpenFreeMap/OpenMapTiles/OpenStreetMap permanece no controle superior esquerdo; `attributionTop` permite posicioná-la abaixo do cabeçalho, acima das folhas inferiores. Não ocultar o controle.

[OpenFreeMap: guia oficial](https://openfreemap.org/quick_start/) e [termos consultados](https://openfreemap.org/tos/) em 28/10/2026: uso comercial permitido, serviço público sem SLA, fornecido como disponível. Não implementamos downloads offline. Caso sejam adicionados, respeitar limites atuais de 3.000 tiles ou 50 MB por download, 4 requisições paralelas e User-Agent próprio; volumes maiores dependem do provedor. Dados OSM têm cobertura variável e não certificam segurança/acessibilidade.

## Uso

Importar `RealMap` de `@/components/map/real-map`. Props em `real-map.types.ts`: `center`, `location` (somente posição autorizada), `route`, `alternativeRoute`, `markers`, `urbanFeatures`, `selectedPoint`, `onMapPress`, `onMarkerPress`, `onViewportChange`, `showControls`, `initialMode`, `zoom`, `followLocation`, `fitRoute`, `controlsTop`, `attributionTop` e `accessibilityLabel`.

`onViewportChange` dispara após o movimento terminar, com debounce de 700 ms e zoom mínimo 12. Consultas urbanas ainda devem impor área máxima, limite de features e cache no backend. `onMarkerPress` fornece o id do marcador/feature para a tela apresentar fonte e data. Não tratar ausência de dados como caminho seguro. A câmera só segue localização quando `followLocation` é verdadeiro.

## Worker web e execução

MapLibre6 exige worker externo. `prestart`, `preweb` e `prebuild:web` copiam o worker oficial da versão instalada para `apps/mobile/public/maplibre-worker.mjs`, servido na mesma origem e incluído pelo export do Expo. O arquivo gerado é ignorado pelo Git. Ao usar o CLI diretamente, execute antes `node src/components/map/sync-maplibre-worker.cjs` dentro de `apps/mobile`. Em hospedagem sob subpasta, ajuste o URL público do worker no adaptador junto da configuração base do Expo; o deploy atual supõe raiz do domínio.

```powershell
npm run web -w @safewalk/mobile
npm run build:web -w @safewalk/mobile
node --import tsx --test apps/mobile/src/components/map/real-map.test.mjs
```

Expo Go não contém o módulo nativo: exibe orientação para development build, sem simular um mapa real. Para compilar no aparelho, usar `npx expo run:android`, ou um development build EAS, conforme as regras do projeto. O plugin MapLibre e o plugin expo-location estão no app.json; a permissão de localização em segundo plano só deve ser solicitada pelo fluxo de acompanhamento com consentimento. A renderização nativa e as permissões precisam ser verificadas em aparelho; export web e typecheck não comprovam essa execução.

Referências: [SDK58](https://docs.expo.dev/versions/v58.0.0/), [MapLibreRN instalação](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/), [migração v11](https://maplibre.org/maplibre-react-native/docs/setup/migrations/v11/), [GLJS v6](https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/).

## Auditoria de dependências

A linha GL5 foi descartada após `npm audit` apontar GHSA-jrc7-96c5-q579. GL6.16 elimina essa vulnerabilidade na árvore instalada. Persistem avisos da árvore ExpoCLI (`zod` e `deepmerge`); não foi aplicado `audit fix --force`, que sugeria downgrade para SDK54 e quebraria o projeto. Tratar os avisos da cadeia de ferramentas antes de publicar em produção.
