import { Injectable } from '@angular/core';

export interface DiaEscala {
  dia: number;
  mes: number;
  ano: number;
  status: string;
}

export interface Resultado {
  maiorSequencia: number;
  folgas: number[];
  escalaCompleta: DiaEscala[];
  ultimaFolgaMes: number;
}

@Injectable({ providedIn: 'root' })
export class WorkSchedule {
  /**
   * Valida se a lista de folgas respeita a regra de no máximo 2 folgas em qualquer janela de 14 dias.
   */
  public validarRegra14Dias(
    ano: number,
    mes: number,
    folgas: number[],
    ultimaFolgaMesAnterior: number,
    candidato?: number,
  ): boolean {
    const totalDiasMes = new Date(ano, mes, 0).getDate();
    const listaGlobal: number[] = [];

    if (ultimaFolgaMesAnterior > 0) {
      const diasMesAnt = new Date(ano, mes - 1, 0).getDate();
      listaGlobal.push(-(diasMesAnt - ultimaFolgaMesAnterior));
    }

    folgas.forEach((d) => listaGlobal.push(d));
    if (candidato !== undefined && !listaGlobal.includes(candidato)) {
      listaGlobal.push(candidato);
    }
    listaGlobal.sort((a, b) => a - b);

    const menorDia = listaGlobal.length > 0 ? listaGlobal[0] : 1;
    const maiorDia = totalDiasMes;

    for (let base = menorDia; base <= maiorDia; base++) {
      const fimJanela = base + 13;
      const folgasNaJanela = listaGlobal.filter((f) => f >= base && f <= fimJanela);
      if (folgasNaJanela.length > 2) {
        return false;
      }
    }
    return true;
  }

  calcularMelhorEscala(
    ano: number,
    mes: number,
    folgasManuais: number[] = [],
    ultimaFolgaMesAnterior: number = 0,
  ): Resultado {
    const totalDiasMes = new Date(ano, mes, 0).getDate();

    // 1. Mapeia domingos do mês
    const domingos: number[] = [];
    for (let d = 1; d <= totalDiasMes; d++) {
      if (new Date(ano, mes - 1, d).getDay() === 0) {
        domingos.push(d);
      }
    }

    // 2. Define o único domingo de folga permitido
    const domingosManuais = folgasManuais.filter((d) => domingos.includes(d));
    const domingoFolga =
      domingosManuais.length > 0 ? domingosManuais[0] : domingos[Math.floor(domingos.length / 2)];

    // 3. Ponto de origem contínuo do mês anterior
    const inicioVirtual =
      ultimaFolgaMesAnterior > 0
        ? -(new Date(ano, mes - 1, 0).getDate() - ultimaFolgaMesAnterior)
        : -5;

    // 4. Algoritmo combinatório para encontrar escalas estritamente válidas
    const sequenciasValidas: number[][] = [];

    const buscar = (atual: number[], ultimoDia: number) => {
      // Passos equivalentes a ciclos de 5, 6 e 4 dias de trabalho respectivamente (incluindo o dia da folga)
      const passos = [6, 7, 5];

      for (const passo of passos) {
        const proximo = ultimoDia + passo;

        // Ao ultrapassar o mês, valida a sequência gerada
        if (proximo > totalDiasMes) {
          const temDomingoObrigatorio = atual.includes(domingoFolga);
          const temDomingoProibido = atual.some((d) => domingos.includes(d) && d !== domingoFolga);
          const temFolgasManuais = folgasManuais.every((f) => atual.includes(f));

          if (temDomingoObrigatorio && !temDomingoProibido && temFolgasManuais) {
            sequenciasValidas.push([...atual]);
          }
          continue;
        }

        // Bloqueia qualquer domingo diferente do único permitido
        if (domingos.includes(proximo) && proximo !== domingoFolga) {
          continue;
        }

        atual.push(proximo);
        buscar(atual, proximo);
        atual.pop();
      }
    };

    buscar([], inicioVirtual);

    // 5. Escolhe a sequência que melhor alterna entre 5 e 6 dias (padrão 5-1-6-1)
    let melhoresFolgas: number[] = [];
    let melhorPontuacao = -Infinity;

    for (const seq of sequenciasValidas) {
      let pontuacao = 0;
      let prev = inicioVirtual;
      let cicloEsperado = 5; // Começa preferindo 5, depois alterna para 6

      for (let i = 0; i < seq.length; i++) {
        const trabalhados = seq[i] - prev - 1;

        // Bonifica ciclos que seguem o padrão alternado desejado (5, depois 6, depois 5...)
        if (trabalhados === cicloEsperado) {
          pontuacao += 20;
        } else if (trabalhados === 5 || trabalhados === 6) {
          pontuacao += 10;
        } else if (trabalhados === 4) {
          pontuacao += 2; // Coringa (usado apenas quando necessário)
        }

        // Alterna o ciclo esperado para o próximo passo
        cicloEsperado = cicloEsperado === 5 ? 6 : 5;
        prev = seq[i];
      }

      if (pontuacao > melhorPontuacao) {
        melhorPontuacao = pontuacao;
        melhoresFolgas = seq;
      }
    }

    const folgasFinais = (melhoresFolgas.length > 0 ? melhoresFolgas : [domingoFolga]).sort(
      (a, b) => a - b,
    );

    // 6. Montagem do resultado final
    const escalaDias = Array(totalDiasMes).fill('SABARÁ');
    folgasFinais.forEach((d) => (escalaDias[d - 1] = 'F'));

    const sequenciasFinais = this.obterSequencias(escalaDias);
    const ultimaFolgaDoMes = folgasFinais.length > 0 ? folgasFinais[folgasFinais.length - 1] : 0;

    const escalaCompleta = this.construirEscalaFinal(
      ano,
      mes,
      totalDiasMes,
      folgasFinais,
      ultimaFolgaDoMes,
    );

    return {
      maiorSequencia: sequenciasFinais.length > 0 ? Math.max(...sequenciasFinais) : 0,
      folgas: folgasFinais,
      escalaCompleta,
      ultimaFolgaMes: ultimaFolgaDoMes,
    };
  }

  private obterSequencias(escala: string[]): number[] {
    const sequencias: number[] = [];
    let atual = 0;
    for (const dia of escala) {
      if (dia !== 'F') {
        atual++;
      } else {
        if (atual > 0) sequencias.push(atual);
        atual = 0;
      }
    }
    if (atual > 0) sequencias.push(atual);
    return sequencias;
  }

  private construirEscalaFinal(
    ano: number,
    mes: number,
    totalDias: number,
    folgas: number[],
    ultimaFolgaDoMes: number,
  ): DiaEscala[] {
    const escala: DiaEscala[] = [];

    for (let i = 1; i <= totalDias; i++) {
      escala.push({
        dia: i,
        mes: mes,
        ano: ano,
        status: folgas.includes(i) ? 'Folga SABARÁ' : 'SABARÁ',
      });
    }

    const dataProx = new Date(ano, mes, 1);
    const proxMes = dataProx.getMonth() + 1;
    const proxAno = dataProx.getFullYear();

    const diasAteFimDoMes = ultimaFolgaDoMes > 0 ? totalDias - ultimaFolgaDoMes : 0;
    const primeiraFolgaProximoMes = Math.max(1, 6 - diasAteFimDoMes);

    for (let i = 1; i <= 15; i++) {
      escala.push({
        dia: i,
        mes: proxMes,
        ano: proxAno,
        status: i === primeiraFolgaProximoMes ? 'Folga SABARÁ (Projeção)' : 'SABARÁ',
      });
    }

    return escala;
  }
}
