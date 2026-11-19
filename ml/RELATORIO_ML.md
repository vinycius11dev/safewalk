# Relatório de Machine Learning · SafeWalk

**Global Solution FIAP 2026.2 · CitizenTech · Inteligência Artificial & Machine Learning**
Equipe: Enzo Dias (558225), Gabriel Dias (556830), Gabriel Galerani (557421), Gustavo Alves (557876), Leonardo Taschin (554583)
Notebook executado: [`ml/safewalk_ml.ipynb`](safewalk_ml.ipynb) · Dados: [`ml/dados/README.md`](dados/README.md)

---

## 1. Problema e pergunta de ML

O SafeWalk é um app para quem anda a pé por São Paulo, principalmente à noite. Ele já mostra no mapa os sinistros com pedestre registrados pelo Infosiga, mas um ponto no mapa não diz **quão grave** costuma ser um atropelamento naquela situação. Para o cidadão e para o painel da Prefeitura, a pergunta útil é: _em que horários, dias e tipos de via um atropelamento tende a terminar em vítima grave ou morte?_

**Pergunta de ML (classificação binária):** dado um sinistro com pedestre na capital, usando _quando_ aconteceu (hora, dia da semana, mês), _onde_ (tipo de via, esfera da via, coordenadas) e _quais veículos_ estavam envolvidos (carro, moto, bicicleta, ônibus, caminhão), o sinistro teve **vítima grave ou fatal**?

Alvo: `grave_ou_fatal = 1` quando `qtd_gravidade_fatal + qtd_gravidade_grave > 0`.

## 2. Dados reais

| Item            | Detalhe                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonte           | **Infosiga SP / Detran-SP**, arquivos `sinistros_*.csv` do ZIP público ([infosiga.detran.sp.gov.br](https://infosiga.detran.sp.gov.br/), [download](https://infosiga.detran.sp.gov.br/painel/download/file/dados_infosiga.zip)) |
| Licença         | CC BY 4.0                                                                                                                                                                                                                       |
| Download        | 19/11/2026 (ZIP de 141 MB, 9 CSVs; só os 3 de sinistros foram lidos)                                                                                                                                                            |
| Período         | 01/01/2019 a 31/10/2026 (sinistros não fatais só existem no Infosiga desde 2019)                                                                                                                                                |
| Recorte         | Município de São Paulo (IBGE 3550308), sinistros com pedestre, registros `SINISTRO FATAL` e `SINISTRO NAO FATAL`                                                                                                                |
| Volume          | 31.139 sinistros → 30.588 com gravidade apurada → **29.410 com registro completo** (seção 4)                                                                                                                                    |
| Classe positiva | 18,1% grave ou fatal (desbalanceado)                                                                                                                                                                                            |

Na exploração, a proporção de casos graves muda bastante com a hora: entre 1h e 4h, de **31% a 39%** dos atropelamentos são graves ou fatais; no meio do dia, cerca de **15%**. Também é maior no domingo (25%) do que de terça a quinta (16%), e muito maior em rodovias dentro da capital (53%) do que em vias urbanas (17%).

## 3. Escolha do modelo: XGBoost

- Os dados são **tabulares e mistos** (categorias de via, contagens de veículos, hora, coordenadas). Árvores com boosting são a referência para esse formato e não precisam de normalização.
- O XGBoost capta **interações** (madrugada × rodovia × veículo pesado) sem criá-las à mão.
- Lida com o **desbalanceamento** via `scale_pos_weight` (negativos/positivos no treino).
- Permite medir a **importância das variáveis**, o que ajuda a explicar o resultado ao cidadão.
- Descartados: **MLP** e **LSTM** pedem mais dados e não há sequência temporal por indivíduo. **KMeans+PCA** não responde a uma pergunta supervisionada. **Random Forest** seria viável, mas costuma ficar abaixo do boosting em dados tabulares.

## 4. Preparação e divisão treino/teste

**Limpeza:**

- Coordenadas com vírgula decimal convertidas.
- `hora_sinistro` (HH:MM) vira hora inteira.
- Dias normalizados (`Terça-feira` → `Terça`).
- Variáveis derivadas: `noite` (19h–5h), `fim_de_semana`, `veic_pesado` (ônibus ou caminhão).
- Categóricas em one-hot, com categorias raras agrupadas e categorias novas ignoradas no teste.

**Vazamento: o principal achado da preparação.** Além de retirar o óbvio (`tipo_registro`, `qtd_gravidade_*`, `tp_sinistro_primario`, `id_sinistro`), a exploração mostrou que **óbitos e casos não fatais chegam ao Infosiga por fluxos de registro diferentes**, e o _formato do registro_ revela o alvo:

| Sinal no registro                             | % grave/fatal quando aparece | % no restante     |
| --------------------------------------------- | ---------------------------- | ----------------- |
| hora ausente (104 casos)                      | **100%**                     | 19%               |
| `tipo_via = NAO DISPONIVEL` (216)             | **100%**                     | 18%               |
| `circunscricao` não disponível (305)          | 79%                          | 18%               |
| coordenada ausente ou fora da capital (1.038) | 38%                          | 18%               |
| `qtd_veic_outros > 0`                         | 20% dos fatais               | 2% dos não fatais |

**Decisão:** treinar só com **registros completos** (96,1% da base) e remover as colunas que descrevem o registro e não a rua: `qtd_veic_outros`, `tipo_local`, `qtd_pedestre`, `administracao` e `conservacao` (esta última é o nome da concessionária). Um app nunca teria esses sinais no momento de avisar alguém. A primeira versão, sem essa limpeza, parecia melhor em validação (AUC 0,69), mas era um resultado inflado.

**Divisão temporal:** treino com **2019–2024** (23.778 sinistros, 17,2% graves) e teste com **2025–out/2026** (5.632 sinistros, 21,9% graves). Isso simula o uso real: aprender com o passado e prever casos que o modelo ainda não viu. O teste não foi usado em nenhuma decisão de modelagem.

## 5. Treino com diferentes hiperparâmetros

Busca em grade com **18 combinações** de 3 hiperparâmetros: `max_depth` ∈ {3, 5, 8}, `learning_rate` ∈ {0,03, 0,1, 0,3} e `n_estimators` ∈ {150, 400}. Cada combinação passou por **validação cruzada estratificada de 5 dobras apenas no treino** (90 ajustes). Os demais parâmetros ficaram fixos: `subsample = 0,8`, `colsample_bytree = 0,8`, `tree_method = hist`, semente 42.

**Métrica de escolha: ROC-AUC.** Com 18% de positivos, a acurácia engana: um modelo que sempre responde "leve" acertaria 82%. A ROC-AUC mede se o modelo coloca os casos graves acima dos leves. Também registramos PR-AUC, recall e F1 da classe grave.

| Posição | max_depth | learning_rate | n_estimators | AUC treino (CV) | AUC validação (CV) | Gap  |
| ------- | --------- | ------------- | ------------ | --------------- | ------------------ | ---- |
| 1       | 3         | 0,03          | 400          | 0,689           | **0,643** ± 0,005  | 0,05 |
| 2       | 5         | 0,03          | 150          | 0,706           | 0,643              | 0,06 |
| 4       | 3         | 0,03          | 150          | 0,661           | 0,642              | 0,02 |
| 10      | 8         | 0,03          | 400          | 0,962           | 0,611              | 0,35 |
| 18      | 8         | 0,30          | 150          | 0,999           | 0,579              | 0,42 |

A tabela completa das 18 combinações está em `ml/figuras/grid_resultados.csv`, e o mapa de calor em `ml/figuras/02_grid_heatmap.png`.

## 6. Resultados em treino e teste

Modelo final: `max_depth = 3`, `learning_rate = 0,03`, `n_estimators = 400`, retreinado com todo o treino. Limiar de 0,5.

| Métrica             | XGBoost · treino | XGBoost · teste | Baseline aleatório · teste |
| ------------------- | ---------------- | --------------- | -------------------------- |
| ROC-AUC             | 0,681            | **0,644**       | 0,498                      |
| PR-AUC              | 0,360            | **0,351**       | 0,218                      |
| Recall (grave)      | 0,568            | **0,528**       | 0,164                      |
| Precisão (grave)    | 0,279            | 0,311           | 0,214                      |
| F1 (grave)          | 0,374            | **0,391**       | 0,185                      |
| Acurácia balanceada | 0,631            | 0,600           | 0,498                      |

Gráficos: `04_metricas_treino_teste.png` (lado a lado), `05_roc_pr_confusao.png` (ROC, precisão × recall e matriz de confusão), `06_importancia.png` e `07_risco_hora_mapa.png`.

**Overfitting.** O gráfico `03_overfitting_grid.png` mostra o padrão clássico. Quanto mais profundas as árvores e maior o passo, mais a AUC de treino sobe e mais a de validação cai:

- a combinação mais complexa chega a **AUC 1,00 no treino e 0,58 na validação**: o modelo decorou os dados;
- o modelo escolhido é o mais simples entre os melhores, com AUC de 0,68 no treino e 0,64 no teste (**gap de 0,04**).

O desempenho no teste ficou praticamente igual ao da validação cruzada (0,644 × 0,643). Isso aconteceu mesmo com a proporção de casos graves subindo de 17% para 22% entre os períodos, sinal de que o modelo generaliza no tempo. Ele recupera **53% dos casos graves** de 2025–2026, contra 16% do baseline, e tem PR-AUC 61% acima do acaso (0,351 contra 0,218).

**O que pesa na previsão** (importância por permutação no teste): a **hora** é a variável mais importante. Depois vêm a presença de **veículo pesado** (ônibus/caminhão), de automóvel, o indicador de **noite**, o **tipo de via** (rodovia × via urbana) e a localização.

## 7. Conclusão: o que isso significa para o cidadão

- **A noite muda a gravidade.** Nos atropelamentos de 2025–2026, **29,2%** dos ocorridos entre 19h e 5h foram graves ou fatais, contra **18,6%** de dia. Entre 1h e 4h, a taxa ficou entre 34% e 49%. Para quem volta a pé da faculdade ou do trabalho, o mesmo trajeto pesa mais depois das 21h.
- **Veículo pesado e rodovia agravam.** Com ônibus ou caminhão envolvido, 25% dos atropelamentos são graves, contra 17% sem eles. Nos trechos de estradas e rodovias dentro da capital, mais da metade é grave.
- **Como o SafeWalk usa isso:**
  - **No app:** o escore entra como _prioridade de aviso_, não como selo de rua segura. O app destaca com mais ênfase os registros do Infosiga perto da rota quando a caminhada é à noite ou cruza via de tráfego pesado, e reforça a sugestão de ativar o acompanhamento por um contato de confiança.
  - **No painel da Prefeitura:** o escore ajuda a priorizar onde iluminação, travessias e fiscalização noturna evitariam mais mortes.
- **Limites, com honestidade:**
  - Desempenho moderado (AUC 0,64). Hora, local e veículo explicam só parte da gravidade; faltam velocidade, iluminação no momento e idade da vítima.
  - O modelo estima a gravidade _dado que houve atropelamento_. Ele não mede a chance de ser atropelado, porque não há dados de quantas pessoas passam em cada rua.
  - Mesmo nos registros completos, a forma de registrar fatais e não fatais pode deixar diferenças residuais, por exemplo na contagem de veículos.
  - As coordenadas do Infosiga têm precisão desconhecida, e casos leves tendem a ser sub-registrados.
  - O escore não é probabilidade calibrada: o `scale_pos_weight` empurra os valores para cima, então o que vale é a ordem.

**Próximos passos:**

- Incluir chuva por hora (INMET), iluminação pública e semáforos do GeoSampa, que o app já integra.
- Calibrar as probabilidades e reavaliar o modelo a cada nova carga do Infosiga.

---

_Reprodução: `pip install -r ml/requirements.txt`, depois `python ml/preparar_dados.py <zip>` e `jupyter nbconvert --execute --inplace ml/safewalk_ml.ipynb`. Versões: Python 3.13, pandas 3.0, scikit-learn 1.9, XGBoost 3.4, semente 42._
