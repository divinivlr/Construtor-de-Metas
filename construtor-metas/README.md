# Construtor de Metas Trimestrais (Out · Nov · Dez)

Sistema web para definir e distribuir metas de vendas do 4º trimestre em três níveis:

1. **Diretoria** – meta por indústria (fornecedor) e mês, e qual gerente é dono de cada indústria.
2. **Gerentes** – cada gerente divide a meta das indústrias da sua carteira entre as equipes que vendem essas indústrias.
3. **Supervisores** – cada supervisor divide a meta da sua equipe, por indústria e mês, entre os vendedores, com sugestão automática pelo histórico, validação de “furo” e exportação para Excel.

Todas as etapas existem em **duas métricas**, alternadas no seletor **“Meta em edição”** no topo da tela:

- **Financeiro (R$)** – meta de faturamento; a sugestão usa o histórico de R$.
- **Positivação (clientes)** – meta de clientes positivados (números inteiros); a sugestão usa o histórico de positivação.

As metas de cada métrica são independentes, mas a carteira dos gerentes e as equipes são as mesmas para as duas.

Stack: **React 18 + Vite 5 + Tailwind CSS 3 + Lucide React + ExcelJS**. Não precisa de servidor nem banco de dados: os dados ficam no navegador de quem usa.

---

## Estrutura de pastas

```
construtor-metas/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx               # ponto de entrada
    ├── App.jsx                # cabeçalho, navegação entre as etapas (rotas por #hash)
    ├── store.jsx              # estado global + salvamento automático no navegador
    ├── index.css              # Tailwind + classes utilitárias (card, btn, th, td…)
    ├── components/
    │   └── ui.jsx             # MoneyInput, BaseSelector (filtro de média), StatusPill, Kpi…
    ├── pages/
    │   ├── Diretoria.jsx      # Etapa 1
    │   ├── Gerente.jsx        # Etapa 2
    │   ├── Supervisor.jsx     # Etapa 3 (sugestão, edição, validação, exportação)
    │   └── Dados.jsx          # Upload da base, configurações e backup
    └── lib/
        ├── constants.js       # ⚙️ carteira dos gerentes, equipes "Outros", limiar de vínculo
        ├── metrica.js         # definição das métricas Financeiro / Positivação
        ├── history.js         # modelo do histórico: médias, melhor mês, pesos, vínculos
        ├── allocate.js        # rateio proporcional que fecha exatamente nos centavos
        ├── metas.js           # leitura e validação das metas em cada nível
        ├── mockData.js        # linhas de exemplo usadas no botão "Baixar modelo"
        ├── importExcel.js     # leitura da "Base Histórico.xlsx"
        └── exportExcel.js     # geração dos .xlsx formatados
```

---

## Rodar localmente

Pré-requisito: **Node.js 18 ou superior** (https://nodejs.org).

```bash
cd construtor-metas
npm install        # instala as dependências
npm run dev        # abre em http://localhost:5173
```

Para testar a versão de produção:

```bash
npm run build      # gera a pasta dist/
npm run preview    # serve a pasta dist/ em http://localhost:4173
```

O sistema já abre com a **base histórica real** embutida (`src/data/baseHistorico.json`, gerada a partir da `Base Histórico.xlsx`), com o selo **BASE** no topo. Todo mundo que acessar o link vê a mesma base, sem precisar carregar planilha.

---

## Deploy no Vercel

### Opção A – pelo GitHub (recomendado)

1. Crie um repositório no GitHub e envie a pasta do projeto (`git init`, `git add .`, `git commit`, `git push`).
   O `.gitignore` já impede que arquivos `.xlsx` (como a base real) sejam enviados.
2. Em https://vercel.com → **Add New… → Project** → importe o repositório.
3. O Vercel detecta **Vite** sozinho (Build Command `npm run build`, Output Directory `dist`). Clique em **Deploy**.
4. A cada `git push`, o Vercel publica a nova versão.

### Opção B – pela linha de comando

```bash
npm i -g vercel
cd construtor-metas
vercel            # primeira vez: responde às perguntas (aceite os padrões)
vercel --prod     # publica em produção
```

> **Atenção — acesso:** a base real (nomes de vendedores e faturamento) faz parte do site publicado. Deixar o **repositório** do GitHub privado protege o código, mas **não** o site: o endereço `*.vercel.app` abre para qualquer pessoa que tiver o link. Para restringir o acesso, ative a proteção do Vercel em **Project → Settings → Deployment Protection** (login do Vercel ou senha) e confira se ela cobre o domínio de produção.

### Atualizar a base histórica para todos

1. Salve a planilha nova (mesmo layout) em qualquer pasta.
2. No terminal, dentro da pasta do projeto:
   ```bash
   npm run atualizar-base -- "C:\caminho\Base Histórico.xlsx"
   ```
   O comando regrava `src/data/baseHistorico.json` e mostra quantas linhas, meses, vendedores e indústrias leu.
3. Faça commit e push (`git add . && git commit -m "Atualiza base" && git push`). O Vercel publica sozinho.

Em **Base & Config → Selecionar planilha** também dá para carregar outra planilha, mas ela vale só para aquele navegador. Serve para testes.

---

## Regras de negócio implementadas

### Carteira por gerente (código do fornecedor)

Definida em `src/lib/constants.js` (`FORNECEDOR_GERENTE_PADRAO`) e editável na Etapa 1, na coluna “Gerente”:

| Gerente | Indústrias (cód. fornecedor) |
|---|---|
| V1 | 6090, 187, 8663, 8986, 9536, 7837 |
| V2 | 8629, 1938, 232, 8820, 168, 105, 9623, 9632 |
| V3 | 9322 |

Indústrias que não estão na tabela aparecem como **“Sem gerente”**, com aviso na Etapa 1, até alguém escolher o gerente.

### Equipes

Cada valor da coluna **Varejo Spv** vira uma equipe, com o seu supervisor: VAREJO 1/2/3, INTERIOR 1/3, PONDERADA 1/2, **ATACADO** e **CALL CENTER**.
O Atacado e o Call Center vendem indústrias de mais de um gerente. Por isso recebem meta do V1 para as indústrias do V1 e do V2 para as indústrias do V2, e o supervisor de cada um faz o próprio rateio na Etapa 3.
Só **CÓDIGOS INATIVOS** fica agrupado em “OUTROS”; essa lista pode ser mudada em Base & Config.

Na Etapa 1, o quadro **Consolidado por equipe** soma a meta de cada equipe em todas as indústrias e gerentes, inclusive Atacado e Call Center. Ele também mostra o que ainda não foi distribuído pelos gerentes, e o total é sempre igual à meta da diretoria.

### Vendedor que vende a carteira de outro gerente

Um vendedor é **vinculado** a um gerente quando pelo menos **10%** do faturamento dele (Jan–Set) vem das indústrias desse gerente. O percentual pode ser ajustado em Base & Config.
Exemplo: um vendedor do supervisor do Varejo 1 com 71% do faturamento em indústrias do V2 entra no rateio das indústrias do V2. Ele continua na equipe VAREJO 1, e o gerente V2 passa a ver a VAREJO 1 entre as suas equipes.

### Sugestão automática

- **Gerente:** meta da indústria × (média da equipe ÷ soma das médias das equipes).
- **Supervisor:** meta da equipe × (média do vendedor ÷ soma das médias dos vendedores da equipe).
- Só entram vendedores **ativos** e **vinculados** ao gerente da indústria. Médias negativas (devoluções) contam como zero.
- O rateio usa o método dos maiores restos, em centavos, então a soma sempre fecha **exatamente** na meta.

### Filtro de média (base histórica)

Últimos 3 meses · últimos 6 meses · Jan–Set · média dos 3 melhores meses · melhor mês · meses escolhidos à mão.

### Conferência das médias e do melhor mês

As telas da Diretoria e dos Supervisores podem mostrar o histórico **mês a mês (Jan–Set)**, com o melhor mês destacado. A tela dos Gerentes mostra só o melhor mês e a média, para ficar mais limpa. Os números batem de uma etapa para a outra:

- **Diretoria:** média e melhor mês da indústria, somando todas as equipes (inclusive Atacado e Call Center).
- **Gerentes:** uma linha por equipe, mais a linha “Soma das equipes” e a linha “Indústria (igual à Diretoria)”. Se algum vendedor ficar fora do rateio (sem vínculo com o gerente, inativo ou código inativo), a diferença aparece numa linha própria.
- **Supervisores:** uma linha por vendedor, mais a linha “Soma dos vendedores” e a linha “Equipe (igual à tela do gerente)”.

Com a base real, a Colgate em Financeiro (média Jul–Set) dá: Varejo 1 R$ 615.706,05 + Ponderada 1 R$ 3.148.562,60 + Atacado R$ 606.796,47 + Call Center R$ 14.415,00 = **R$ 4.385.480,12**. O melhor mês é **Jan, R$ 5.234.751,08**.

### Completar rateio

Na tela dos gerentes, o botão **Completar** (por indústria) ou **Completar pendentes** (todas) distribui só a diferença que falta para fechar a meta. A diferença vai primeiro para as equipes com histórico que estão sem meta (ex.: Atacado e Call Center), sem mexer no que já foi digitado.

### Validação e exportação

Cada indústria mostra a soma dos vendedores, a meta da equipe e a diferença por mês. O botão **Exportar para Excel (.xlsx)** só fica ativo quando **Financeiro e Positivação** batem a meta em **todas** as indústrias da equipe. O botão **Ajustar diferença** lança o que falta, ou o que sobra, no vendedor com maior meta.

O arquivo exportado traz as duas métricas lado a lado, em R$ e em clientes, e tem 5 abas: *Metas por Vendedor*, *Mensal por Vendedor*, *Conferência*, *Vend x Ind (R$)* e *Vend x Ind (Posit.)*. Tem cabeçalho, formatos de R$ e de inteiro, filtros, painéis congelados e totais com fórmula.

> Backups e dados salvos de versões anteriores são convertidos automaticamente: as metas antigas viram metas de Financeiro. O rateio que tinha sido feito para “OUTROS” (Atacado + Call Center juntos) é descartado e precisa ser refeito pelos gerentes.

---

## Como o trabalho passa de um nível para o outro

Como não há servidor, o estado fica salvo no navegador (localStorage). Para passar o trabalho de uma pessoa para outra:

1. A diretoria preenche a Etapa 1 → **Base & Config → Exportar backup (.json)** → envia o arquivo ao gerente.
2. O gerente faz **Importar backup**, preenche a Etapa 2 e exporta um novo backup para os supervisores.
3. O supervisor importa, faz o rateio e exporta o Excel final.

**Próximo passo sugerido:** para uso simultâneo com login por perfil, troque o `localStorage` em `src/store.jsx` por um banco (Supabase ou Firebase, por exemplo). As telas não precisam mudar.

---

## Layout esperado da planilha de histórico

Uma linha por **vendedor × indústria × mês**. A ordem das colunas não importa, e o sistema tolera variações de acento e maiúsculas no cabeçalho.

| Cod Vendedor | Nome Vendedor | Varejo Spv | Nome Supervisor | Cod Fornecedor | Nome Fornecedor | Mês | Ano | R$ Faturamento | Positivação |
|---|---|---|---|---|---|---|---|---|---|
| 1101 | FULANO | VAREJO 1 | CICLANO | 6090 | COLGATE… | jan | 2026 | 6560,21 | 47 |

O mês pode vir como `jan`, `1` ou como data. O botão **Baixar modelo** gera um exemplo.
