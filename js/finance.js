// Regras financeiras centralizadas (espelham as funções do banco).
//
//   Faturamento   = quantidade × preço unitário
//   Custo         = quantidade × custo unitário
//   Lucro bruto   = faturamento − custo − desconto
//   Repasse (10%) = lucro_bruto × percentual  (somente se lucro_bruto > 0)
//   Lucro líquido = lucro_bruto − repasse

export const PERCENTUAL_REPASSE_PADRAO = 10

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export function calcularItem(quantidade, precoUnitario, custoUnitario, desconto = 0, percentualRepasse = PERCENTUAL_REPASSE_PADRAO) {
  const faturamento = round2(quantidade * precoUnitario)
  const custo = round2(quantidade * custoUnitario)
  const lucroBruto = round2(faturamento - custo - desconto)
  const valorRepasse = round2(Math.max(lucroBruto, 0) * (percentualRepasse / 100))
  const lucroLiquido = round2(lucroBruto - valorRepasse)
  return { faturamento, custo, desconto, lucroBruto, valorRepasse, lucroLiquido }
}

export function somarResultados(itens) {
  return itens.reduce(
    (acc, r) => ({
      faturamento: round2(acc.faturamento + r.faturamento),
      custo: round2(acc.custo + r.custo),
      desconto: round2(acc.desconto + r.desconto),
      lucroBruto: round2(acc.lucroBruto + r.lucroBruto),
      valorRepasse: round2(acc.valorRepasse + r.valorRepasse),
      lucroLiquido: round2(acc.lucroLiquido + r.lucroLiquido),
    }),
    { faturamento: 0, custo: 0, desconto: 0, lucroBruto: 0, valorRepasse: 0, lucroLiquido: 0 },
  )
}

// Métricas de cadastro de produto.
export function metricasProduto(p) {
  const investidoTotal = round2(p.quantidade_estoque * p.custo_unitario)
  const lucroUnidade = round2(p.preco_venda - p.custo_unitario)
  const margem = p.preco_venda > 0 ? round2((lucroUnidade / p.preco_venda) * 100) : 0
  const potencialVenda = round2(p.quantidade_estoque * p.preco_venda)
  const lucroPotencial = round2(potencialVenda - investidoTotal)
  return { investidoTotal, lucroUnidade, margem, potencialVenda, lucroPotencial }
}
