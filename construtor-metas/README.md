# Construtor de Metas Trimestrais (Out · Nov · Dez)

Sistema web para definir e distribuir metas de vendas do 4º trimestre em três níveis:

1. **Diretoria** – meta por indústria (fornecedor) e mês, e qual gerente é dono de cada indústria.
2. **Gerentes** – cada gerente divide a meta das indústrias da sua carteira entre as equipes que vendem essas indústrias.
3. **Supervisores** – cada supervisor divide a meta da sua equipe, por indústria e mês, entre os vendedores, com sugestão automática pelo histórico, validação de “furo” e exportação para Excel.

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
        ├── history.js         # modelo do histórico: médias, melhor mês, pesos, vínculos
        ├── allocate.js        # rateio proporcional que fecha exatamente nos centavos
        ├── metas.js           # leitura e validação das metas em cada nível
        ├── mockData.js        # base fictícia (mesmo layout da planilha real)
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

O sistema já abre com **dados fictícios** (selo DEMO no topo). Para usar a base real, vá em **Base & Config → Selecionar planilha** e escolha a `Base Histórico.xlsx`. O selo muda para REAL.

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

> **Privacidade:** a URL do Vercel é pública, mas o código publicado só tem dados fictícios. A planilha real é lida no navegador de quem a carrega e **não é enviada para nenhum servidor**.

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

Cada valor da coluna **Varejo Spv** vira uma equipe (VAREJO 1, VAREJO 2, INTERIOR 1, PONDERADA 2…). **ATACADO, CALL CENTER e CÓDIGOS INATIVOS** são somadas na equipe **OUTROS**. Essa lista pode ser mudada em Base & Config.

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

### Validação e exportação

Cada indústria mostra a soma dos vendedores, a meta da equipe e a diferença por mês. O botão **Exportar para Excel (.xlsx)** só fica ativo quando **todas** as indústrias da equipe batem a meta. O botão **Ajustar diferença** lança o que falta, ou o que sobra, no vendedor com maior meta.

O arquivo exportado tem 4 abas: *Metas por Vendedor*, *Conferência*, *Vendedor x Indústria* e *Mensal por Vendedor*. Tem cabeçalho, formato em R$, filtros, painéis congelados e totais com fórmula.

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
