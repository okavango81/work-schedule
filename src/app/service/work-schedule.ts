import { Injectable } from '@angular/core';

export interface Resultado {
  folgas: number[];
  maiorSequencia: number;
  ultimaFolgaMes: number;
}

@Injectable({ providedIn: 'root' })
export class WorkSchedule {

  calcularMelhorEscala(
    ano: number,
    mes: number,
    folgasManuais: number[],
    ultimaFolgaMesAnterior: number,
    domingoManual?: number
  ): Resultado {
    const ultimoDia = this.ultimoDiaDoMes(ano, mes);

    // 1. GARANTIA ABSOLUTA DE APENAS 1 DOMINGO
    const domingosManuais = folgasManuais.filter(d => this.isDomingo(ano, mes, d));
    let domingo = domingoManual || domingosManuais[0] || this.escolherDomingoAutomatico(ano, mes, folgasManuais);

    // Remove TODOS os domingos das seleções manuais e reinsere apenas o escolhido
    let fixas = folgasManuais.filter(d => !this.isDomingo(ano, mes, d));
    if (domingo) fixas.push(domingo);

    fixas = [...new Set(fixas)].sort((a, b) => a - b);
    let escala = [...fixas];

    // 2. Calcula início baseado no mês anterior (pode resultar negativo)
    let inicio = 0;
    if (ultimaFolgaMesAnterior > 0) {
      const anoAnt = mes === 1 ? ano - 1 : ano;
      const mesAnt = mes === 1 ? 12 : mes - 1;
      const ultimoDiaAnt = this.ultimoDiaDoMes(anoAnt, mesAnt);
      inicio = ultimaFolgaMesAnterior - ultimoDiaAnt;
    }

    // 3. Preenche do mês anterior até a primeira folga fixa (ou até o fim)
    const alvoInicial = escala.length > 0 ? escala[0] : ultimoDia + 7;
    escala.push(...this.preencherGap(inicio, alvoInicial, ano, mes));
    escala = [...new Set(escala)].sort((a, b) => a - b);

    // 4. Preenche os buracos entre as folgas manuais
    let novas: number[] = [];
    for (let i = 0; i < escala.length - 1; i++) {
      novas.push(...this.preencherGap(escala[i], escala[i + 1], ano, mes));
    }
    escala.push(...novas);
    escala = [...new Set(escala)].sort((a, b) => a - b);

    // 5. Preenche do último dia da escala até o fim do mês
    const final = escala.length > 0 ? escala[escala.length - 1] : inicio;
    const preFinais = this.preencherGap(final, ultimoDia + 7, ano, mes).filter(d => d <= ultimoDia);
    escala.push(...preFinais);
    escala = [...new Set(escala)].sort((a, b) => a - b);

    return this.calcularMetricas(ano, mes, escala);
  }

  private preencherGap(inicio: number, fim: number, ano: number, mes: number): number[] {
    let result: number[] = [];
    let atual = inicio;
    let seguranca = 0;

    while (fim - atual > 7 && seguranca < 50) {
      seguranca++;
      let escolhido = 0;
      const candidatos = [6, 7, 5];

      for (const p of candidatos) {
        const proximo = atual + p;
        const resto = fim - proximo;

        // Bloqueia domingos estritamente
        if (proximo > 0 && this.isDomingo(ano, mes, proximo)) continue;

        if (resto >= 10 || (resto >= 5 && resto <= 7)) {
          escolhido = p;
          break;
        }
      }

      // Fallback blindado: se falhar, pega o primeiro dia que NÃO seja domingo
      if (!escolhido) {
        escolhido = candidatos.find(p => atual + p > 0 && !this.isDomingo(ano, mes, atual + p)) || 6;
      }

      atual += escolhido;
      if (atual >= 1 && atual <= this.ultimoDiaDoMes(ano, mes)) {
        result.push(atual);
      }
    }
    return result;
  }

  private calcularMetricas(ano: number, mes: number, folgas: number[]): Resultado {
    const ultimoDia = this.ultimoDiaDoMes(ano, mes);
    let maior = 0;
    let anterior = 0;
    for (const folga of folgas) {
      const trabalhados = folga - anterior - 1;
      if (trabalhados > maior) maior = trabalhados;
      anterior = folga;
    }
    const final = ultimoDia - anterior;
    if (final > maior) maior = final;
    return {
      folgas,
      maiorSequencia: maior,
      ultimaFolgaMes: folgas.length ? folgas[folgas.length - 1] : 0,
    };
  }

  private isDomingo(ano: number, mes: number, dia: number): boolean {
    return new Date(ano, mes - 1, dia).getDay() === 0;
  }

  private ultimoDiaDoMes(ano: number, mes: number): number {
    return new Date(ano, mes, 0).getDate();
  }

  private escolherDomingoAutomatico(
    ano: number,
    mes: number,
    escala: number[],
  ): number | undefined {
    const ultimoDia = this.ultimoDiaDoMes(ano, mes);
    const domingos: number[] = [];
    for (let d = 1; d <= ultimoDia; d++) {
      if (this.isDomingo(ano, mes, d) && !escala.includes(d)) domingos.push(d);
    }
    if (!domingos.length) return undefined;
    const meio = ultimoDia / 2;
    return domingos.reduce((a, b) => (Math.abs(a - meio) < Math.abs(b - meio) ? a : b));
  }


}
