// ---------------------------------------------------------------------------
// Base FICTÍCIA de histórico (Jan–Set) — mesmo layout da "Base Histórico.xlsx"
// Nomes de vendedores/supervisores e valores são inventados.
// Gerada de forma determinística (mesma semente => mesmos números).
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'];
const SAZONALIDADE = [0.93, 0.84, 0.83, 0.97, 1.0, 0.96, 1.09, 1.0, 1.08];

// Indústrias: código, nome, faturamento mensal aproximado da empresa (fictício), carteira (grupo)
const INDUSTRIAS = [
  { cod: 6090, nome: 'COLGATE PALMOLIVE COMERCIAL LTDA', mensal: 3_600_000, grupo: 'V1' },
  { cod: 187, nome: 'ENERGIZER BRASIL IND. E COM. DE BENS DE CONSUMO', mensal: 210_000, grupo: 'V1' },
  { cod: 8663, nome: 'CIA CANOINHAS DE PAPEL', mensal: 240_000, grupo: 'V1' },
  { cod: 8986, nome: 'INDUSTRIA E COMERCIO SANTA MARIA LTDA', mensal: 170_000, grupo: 'V1' },
  { cod: 9536, nome: 'BARRIND INDUSTRIA E COMERCIO DE ALIMENTOS', mensal: 85_000, grupo: 'V1' },
  { cod: 7837, nome: 'FALCON DISTRIBUICAO ARMAZENAMENTO E TRANSP.', mensal: 120_000, grupo: 'V1' },
  { cod: 8629, nome: 'MARILAN NORDESTE IND. DE ALIMENTOS LTDA', mensal: 720_000, grupo: 'V2' },
  { cod: 1938, nome: 'ADL ALIM E DERIVADOS DO LEITE LTDA', mensal: 400_000, grupo: 'V2' },
  { cod: 232, nome: 'J. MACEDO S/A. (DONA BENTA)', mensal: 820_000, grupo: 'V2' },
  { cod: 8820, nome: 'ADIMAX', mensal: 40_000, grupo: 'V2' },
  { cod: 168, nome: 'NUTRIMENTAL S.A.', mensal: 180_000, grupo: 'V2' },
  { cod: 105, nome: 'CONSERVAS ODERICH S.A.', mensal: 200_000, grupo: 'V2' },
  { cod: 9623, nome: 'GUDAY PRODUTOS ALIMENTICIOS LTDA', mensal: 3_000, grupo: 'V2' },
  { cod: 8711, nome: 'MARILAN PANETTONE', mensal: 90_000, grupo: 'V2' },
  { cod: 9322, nome: 'GRENDENE S A', mensal: 880_000, grupo: 'V3' },
];

// Equipes fictícias. `mix` = participação do vendedor em cada carteira.
const EQUIPES = [
  { spv: 'VAREJO 1', sup: 'RENATA ALBUQUERQUE', base: 1100, n: 9, mix: { V1: 1 }, cruzados: { 7: { V1: 0.2, V2: 0.8 }, 8: { V1: 0.45, V2: 0.55 } } },
  { spv: 'VAREJO 2', sup: 'GUSTAVO MENDES', base: 2100, n: 7, mix: { V2: 1 } },
  { spv: 'VAREJO 3', sup: 'PRISCILA NOGUEIRA', base: 3100, n: 7, mix: { V3: 1 } },
  { spv: 'INTERIOR 1', sup: 'ROBERTO CAVALCANTI', base: 1300, n: 9, mix: { V1: 0.28, V2: 0.72 } },
  { spv: 'INTERIOR 3', sup: 'TATIANE MOURA', base: 3300, n: 8, mix: { V3: 1 } },
  { spv: 'PONDERADA 1', sup: 'MARCELO TAVARES', base: 1400, n: 9, mix: { V1: 1 } },
  { spv: 'PONDERADA 2', sup: 'CAMILA RESENDE', base: 2400, n: 7, mix: { V2: 1 } },
  { spv: 'ATACADO', sup: 'OTAVIO PRADO', base: 1500, n: 2, mix: { V1: 0.8, V2: 0.2 } },
  { spv: 'CALL CENTER', sup: 'LETICIA FARIAS', base: 500, n: 3, mix: { V1: 0.4, V2: 0.6 } },
];

// Peso relativo de cada carteira por equipe (tamanho da equipe naquela carteira)
const PESO_EQUIPE = {
  'VAREJO 1': { V1: 0.17, V2: 0.07 },
  'VAREJO 2': { V2: 0.2 },
  'VAREJO 3': { V3: 0.66 },
  'INTERIOR 1': { V1: 0.06, V2: 0.36 },
  'INTERIOR 3': { V3: 0.34 },
  'PONDERADA 1': { V1: 0.62 },
  'PONDERADA 2': { V2: 0.29 },
  ATACADO: { V1: 0.11, V2: 0.05 },
  'CALL CENTER': { V1: 0.01, V2: 0.03 },
};

const NOMES = [
  'ANA PAULA SOUZA', 'BRUNO CARVALHO', 'CARLA MENEZES', 'DANIEL ARAUJO', 'EDUARDA PINTO', 'FELIPE MOTA',
  'GABRIELA ROCHA', 'HUGO BARROS', 'ISABELA CUNHA', 'JOAO VITOR LEAL', 'KARINA DUARTE', 'LEONARDO SALES',
  'MARIANA FREIRE', 'NATAN BRAGA', 'OLIVIA TEIXEIRA', 'PAULO HENRIQUE', 'QUESIA LOPES', 'RAFAEL MACHADO',
  'SABRINA COSTA', 'TIAGO MONTEIRO', 'URSULA VIANA', 'VINICIUS PORTO', 'WANDERSON REIS', 'XAVIER MELO',
  'YASMIN QUEIROZ', 'ZECA FONSECA', 'ALINE BEZERRA', 'BENTO FARIAS', 'CICERO GOMES', 'DEBORA LUZ',
  'EMERSON DIAS', 'FABIOLA RAMOS', 'GILSON PAIVA', 'HELENA CASTRO', 'IGOR NUNES', 'JULIANA TORRES',
  'KLEBER SANTANA', 'LARISSA MOURA', 'MATEUS CORREIA', 'NAYARA LIMA', 'OSVALDO PIRES', 'PATRICIA SILVA',
  'RICARDO NERY', 'SIMONE AGUIAR', 'THALES BRITO', 'VALERIA CAMPOS', 'WESLEY AMORIM', 'ADRIANA MAIA',
  'BRENO FALCAO', 'CLAUDIA REGO', 'DIEGO MARINHO', 'ELAINE PRADO', 'FERNANDO LUZ', 'GISELE ALVES',
  'HENRIQUE BASTOS', 'IARA MEDEIROS', 'JONAS FREITAS', 'LUANA PEIXOTO', 'MURILO ANDRADE', 'NICOLE BATISTA',
  'OTAVIANO SILVA', 'PEDRO LUCAS',
];

let CACHE = null;

export function gerarHistoricoFicticio(seed = 20260930) {
  if (CACHE) return CACHE;
  const rnd = mulberry32(seed);
  const rows = [];
  let nomeIdx = 0;

  // Monta vendedores com fator de tamanho
  const vendedores = [];
  for (const eq of EQUIPES) {
    for (let i = 1; i <= eq.n; i++) {
      const mix = eq.cruzados?.[i] || eq.mix;
      vendedores.push({
        cod: eq.base + i,
        nome: NOMES[nomeIdx++ % NOMES.length],
        spv: eq.spv,
        sup: eq.sup,
        mix,
        tamanho: 0.55 + rnd() * 0.9, // força de vendas relativa
        tendencia: -0.03 + rnd() * 0.06, // crescimento mensal
      });
    }
  }

  for (const ind of INDUSTRIAS) {
    // vendedores que vendem esta indústria
    const elegiveis = vendedores
      .map((v) => {
        const share = v.mix[ind.grupo] || 0;
        const pesoEq = PESO_EQUIPE[v.spv]?.[ind.grupo] || 0;
        if (!share || !pesoEq) return null;
        // nem todo vendedor vende indústrias pequenas
        if (ind.mensal < 100_000 && rnd() < 0.3) return null;
        return { v, w: share * v.tamanho * (0.7 + rnd() * 0.6), pesoEq };
      })
      .filter(Boolean);

    // normaliza pesos dentro de cada equipe
    const somaPorEquipe = {};
    for (const e of elegiveis) somaPorEquipe[e.v.spv] = (somaPorEquipe[e.v.spv] || 0) + e.w;
    const somaPesoEq = [...new Set(elegiveis.map((e) => e.v.spv))].reduce(
      (a, spv) => a + (PESO_EQUIPE[spv]?.[ind.grupo] || 0),
      0
    );

    for (const e of elegiveis) {
      const participacao = (e.pesoEq / somaPesoEq) * (e.w / somaPorEquipe[e.v.spv]);
      MESES.forEach((mes, idx) => {
        let saz = SAZONALIDADE[idx];
        if (ind.cod === 8711) saz *= 0.4 + idx * 0.18; // panetone cresce no 2º semestre
        const ruido = 0.78 + rnd() * 0.44;
        const queda = rnd() < 0.04 ? 0.25 : 1; // mês ruim ocasional
        const fat = ind.mensal * participacao * saz * ruido * queda * (1 + e.v.tendencia * idx);
        if (fat < 5) return;
        const clientes = 9 * Math.sqrt(fat / 1000) * (0.8 + rnd() * 0.4);
        rows.push({
          codVend: e.v.cod,
          nomeVend: e.v.nome,
          spv: e.v.spv,
          supervisor: e.v.sup,
          codForn: ind.cod,
          nomeForn: `(DEMO) ${ind.nome}`,
          mes: idx + 1,
          ano: 2026,
          fat: Math.round(fat * 100) / 100,
          pos: Math.max(1, Math.round(clientes)),
        });
      });
    }
  }
  CACHE = rows;
  return rows;
}
