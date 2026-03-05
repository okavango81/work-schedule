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
   * Valida se a lista de folgas (incluindo um candidato opcional)
   * respeita a regra de no máximo 2 folgas em qualquer janela de 14 dias.
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

    // ---- 1. Identificar domingos do mês ----
    const domingos: number[] = [];
    for (let d = 1; d <= totalDiasMes; d++) {
      if (new Date(ano, mes - 1, d).getDay() === 0) {
        domingos.push(d);
      }
    }

    // ---- 2. Inicializar lista de folgas com as manuais ----
    let folgasFinais = [...folgasManuais].sort((a, b) => a - b);

    // ---- 3. Regra do domingo único (garantir exatamente 1) ----
    const domingosMarcados = folgasFinais.filter((d) => domingos.includes(d));
    if (domingosMarcados.length === 0 && domingos.length > 0) {
      const domIdeal = domingos[Math.floor(domingos.length / 2)];
      folgasFinais.push(domIdeal);
    } else if (domingosMarcados.length > 1) {
      const primeiroDom = domingosMarcados[0];
      folgasFinais = folgasFinais.filter((d) => !domingos.includes(d) || d === primeiroDom);
    }
    folgasFinais.sort((a, b) => a - b);

    // ---- 4. Funções auxiliares ----
    const obterIntervalos = (folgas: number[]) => {
      let inicioVirtual = 0;
      if (ultimaFolgaMesAnterior > 0) {
        const diasMesAnt = new Date(ano, mes - 1, 0).getDate();
        inicioVirtual = -(diasMesAnt - ultimaFolgaMesAnterior);
      }
      const arr = [inicioVirtual, ...[...folgas].sort((a, b) => a - b), totalDiasMes + 1];
      const ints = [];
      for (let i = 0; i < arr.length - 1; i++) {
        ints.push({
          inicio: arr[i],
          fim: arr[i + 1],
          tamanho: arr[i + 1] - arr[i] - 1,
        });
      }
      return ints;
    };

    // Verifica se um dia é domingo
    const isDomingo = (dia: number) => domingos.includes(dia);

    // ---- 5. LEI ABSOLUTA 1: Quebrar intervalos > 6 dias (prioridade máxima) ----
    let iteracoes = 0;
    let intervalos = obterIntervalos(folgasFinais);

    while (intervalos.some((i) => i.tamanho > 6) && iteracoes < 100) {
      intervalos.sort((a, b) => b.tamanho - a.tamanho);
      const maior = intervalos[0];

      let diaEncontrado = -1;
      for (let d = Math.max(1, maior.inicio + 1); d < maior.fim; d++) {
        if (d > totalDiasMes) break;

        // ⛔️ Proíbe domingos – já temos um domingo de folga
        if (isDomingo(d)) continue;

        // Proíbe folgas adjacentes
        if (
          folgasFinais.includes(d) ||
          folgasFinais.includes(d - 1) ||
          folgasFinais.includes(d + 1)
        ) {
          continue;
        }

        // Proíbe dia 1 se o último dia do mês anterior foi folga
        if (d === 1 && ultimaFolgaMesAnterior > 0) {
          const diasMesAnt = new Date(ano, mes - 1, 0).getDate();
          if (ultimaFolgaMesAnterior === diasMesAnt) continue;
        }

        // Tenta respeitar a regra de 14 dias, mas se não for possível, força
        if (!this.validarRegra14Dias(ano, mes, folgasFinais, ultimaFolgaMesAnterior, d)) {
          if (iteracoes < 99) continue; // só força na última tentativa
        }

        diaEncontrado = d;
        break;
      }

      if (diaEncontrado !== -1) {
        folgasFinais.push(diaEncontrado);
        folgasFinais.sort((a, b) => a - b);
      } else {
        // Força no meio do maior intervalo, mas evita domingo
        let meio = Math.floor((maior.inicio + maior.fim) / 2);
        // Se o meio for domingo, tenta o próximo ou anterior
        if (isDomingo(meio)) {
          let offset = 1;
          while (isDomingo(meio + offset) || isDomingo(meio - offset)) {
            offset++;
            if (meio + offset >= maior.fim && meio - offset <= maior.inicio) break;
          }
          if (!isDomingo(meio + offset) && meio + offset < maior.fim) meio = meio + offset;
          else if (!isDomingo(meio - offset) && meio - offset > maior.inicio) meio = meio - offset;
          else break; // não encontrou alternativa
        }
        if (
          meio > maior.inicio &&
          meio < maior.fim &&
          !folgasFinais.includes(meio) &&
          !isDomingo(meio)
        ) {
          folgasFinais.push(meio);
          folgasFinais.sort((a, b) => a - b);
        } else {
          break;
        }
      }

      iteracoes++;
      intervalos = obterIntervalos(folgasFinais);
    }

    // ---- 6. Pós-processamento para ajustar a regra de 14 dias ----
    let viola14 = !this.validarRegra14Dias(ano, mes, folgasFinais, ultimaFolgaMesAnterior);
    let tentativas = 0;
    while (viola14 && tentativas < 30) {
      let removida = false;
      for (const f of [...folgasFinais]) {
        // Não remove folgas manuais nem domingos
        if (folgasManuais.includes(f) || isDomingo(f)) continue;
        const testList = folgasFinais.filter((d) => d !== f);
        if (this.validarRegra14Dias(ano, mes, testList, ultimaFolgaMesAnterior)) {
          folgasFinais = testList;
          removida = true;
          break;
        }
      }
      if (!removida) break;
      viola14 = !this.validarRegra14Dias(ano, mes, folgasFinais, ultimaFolgaMesAnterior);
      tentativas++;
    }

    // ---- 7. Garantir mínimo de 4 folgas (sem domingos) ----
    iteracoes = 0;
    while (folgasFinais.length < 4 && iteracoes < 30) {
      intervalos = obterIntervalos(folgasFinais);
      intervalos.sort((a, b) => b.tamanho - a.tamanho);
      const maior = intervalos[0];
      if (maior.tamanho <= 3) break;

      let diaEncontrado = -1;
      for (let d = Math.max(1, maior.inicio + 1); d < maior.fim; d++) {
        // ⛔️ Proíbe domingos
        if (isDomingo(d)) continue;
        if (
          !folgasFinais.includes(d) &&
          !folgasFinais.includes(d - 1) &&
          !folgasFinais.includes(d + 1)
        ) {
          if (
            this.validarRegra14Dias(ano, mes, folgasFinais, ultimaFolgaMesAnterior, d) ||
            iteracoes >= 29
          ) {
            diaEncontrado = d;
            break;
          }
        }
      }

      if (diaEncontrado !== -1) {
        folgasFinais.push(diaEncontrado);
        folgasFinais.sort((a, b) => a - b);
      } else {
        break;
      }
      iteracoes++;
    }

    folgasFinais.sort((a, b) => a - b);

    // ---- 8. Montagem final ----
    const escalaDias = Array(totalDiasMes).fill('SABARÁ');
    folgasFinais.forEach((d) => (escalaDias[d - 1] = 'F'));

    const sequenciasFinais = this.obterSequencias(escalaDias);
    const ultimaFolga = folgasFinais.length > 0 ? folgasFinais[folgasFinais.length - 1] : 0;

    if (ultimaFolgaMesAnterior > 0 && folgasFinais.length > 0) {
      const diasMesAnt = new Date(ano, mes - 1, 0).getDate();
      const virada = diasMesAnt - ultimaFolgaMesAnterior + (folgasFinais[0] - 1);
      sequenciasFinais.push(virada);
    }

    const escalaCompleta = this.construirEscalaFinal(
      ano,
      mes,
      totalDiasMes,
      folgasFinais,
      ultimaFolga,
    );

    return {
      maiorSequencia: sequenciasFinais.length > 0 ? Math.max(...sequenciasFinais) : 0,
      folgas: folgasFinais,
      escalaCompleta,
      ultimaFolgaMes: ultimaFolga,
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
    const primeiraFolgaProximoMes = Math.max(1, 7 - diasAteFimDoMes);

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
