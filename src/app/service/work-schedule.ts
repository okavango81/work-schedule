import { Injectable } from '@angular/core';

export interface DiaEscala {
  dia: number;
  mes: number;
  ano: number;
  status: string;
}

export interface Resultado {
  maiorSequencia: number;
  folgasMJ: number[];
  folgasS: number[];
  escalaCompleta: DiaEscala[];
}

@Injectable({ providedIn: 'root' })
export class WorkSchedule {

  calcularMelhorEscala(
    ano: number,
    mes: number,
    primeiroLocal: 'MENINO JESUS' | 'SAMARITANO',
    folgasManuaisMJ: number[] = [],
    folgasManuaisS: number[] = [],
  ): Resultado {
    const totalDiasMesAtual = new Date(ano, mes, 0).getDate();
    const base: string[] = [];

    // 1. Gerar Escala Base 1x1 para o mês atual
    for (let i = 0; i < totalDiasMesAtual; i++) {
      if (primeiroLocal === 'MENINO JESUS') {
        base[i] = i % 2 === 0 ? 'MENINO JESUS' : 'SAMARITANO';
      } else {
        base[i] = i % 2 === 0 ? 'SAMARITANO' : 'MENINO JESUS';
      }
    }

    // 2. Identificar dias disponíveis para folgas automáticas
    const diasMJ: number[] = [];
    const diasS_Janela1: number[] = []; // Dias 1 a 15
    const diasS_Janela2: number[] = []; // Dias 16 ao fim

    for (let i = 0; i < totalDiasMesAtual; i++) {
      const diaNum = i + 1;
      // Pula se já for uma folga manual em qualquer hospital
      if (folgasManuaisMJ.includes(diaNum) || folgasManuaisS.includes(diaNum)) continue;

      if (base[i] === 'MENINO JESUS') {
        diasMJ.push(i);
      } else {
        // Separa o Samaritano pelas janelas do ciclo 16-15
        if (diaNum <= 15) diasS_Janela1.push(i);
        else diasS_Janela2.push(i);
      }
    }

    // 3. Otimização de Combinações

    // MJ segue a regra de 2 folgas no mês civil
    const folgasMJParaEscolher = Math.max(0, 2 - folgasManuaisMJ.length);
    const combosMJ = this.getCombinations(diasMJ, folgasMJParaEscolher);

    // Samaritano: Garantir 1 folga por quinzena (Ciclo 16-15)
    let combosS: number[][] = [];

    // Se o usuário já definiu as 2 folgas dele, não sugerimos NADA automático
    if (folgasManuaisS.length >= 2) {
      combosS = [[]];
    } else {
      const temManualS1 = folgasManuaisS.some((d) => d <= 15);
      const temManualS2 = folgasManuaisS.some((d) => d >= 16);

      const opcoesS1 = !temManualS1 ? this.getCombinations(diasS_Janela1, 1) : [[]];
      const opcoesS2 = !temManualS2 ? this.getCombinations(diasS_Janela2, 1) : [[]];

      for (const s1 of opcoesS1) {
        for (const s2 of opcoesS2) {
          combosS.push([...s1, ...s2]);
        }
      }
    }

    if (combosS.length === 0) combosS = [[]];
    let melhor: Resultado = {
      maiorSequencia: Infinity,
      folgasMJ: [],
      folgasS: [],
      escalaCompleta: [],
    };
    let copiaMelhor: string[] = [];

    for (const cMJ of combosMJ) {
      if (!this.validarRegraDomingo(cMJ, folgasManuaisMJ, ano, mes)) continue;
      for (const cS of combosS) {
        if (!this.validarRegraDomingo(cS, folgasManuaisS, ano, mes)) continue;

        const copia = [...base];
        // Aplica folgas manuais
        folgasManuaisMJ.forEach((d) => (copia[d - 1] = 'F'));
        folgasManuaisS.forEach((d) => (copia[d - 1] = 'F'));
        // Aplica folgas automáticas
        cMJ.forEach((idx) => (copia[idx] = 'F'));
        cS.forEach((idx) => (copia[idx] = 'F'));

        const seq = this.calcularMaiorSequencia(copia);
        if (seq < melhor.maiorSequencia) {
          melhor.maiorSequencia = seq;
          melhor.folgasMJ = [...folgasManuaisMJ, ...cMJ.map((i) => i + 1)].sort((a, b) => a - b);
          melhor.folgasS = [...folgasManuaisS, ...cS.map((i) => i + 1)].sort((a, b) => a - b);
          copiaMelhor = [...copia];
        }
      }
    }

    // Caso não encontre solução (raro), garante a exibição básica
    if (copiaMelhor.length === 0) {
      copiaMelhor = [...base];
      folgasManuaisMJ.forEach((d) => (copiaMelhor[d - 1] = 'F'));
      folgasManuaisS.forEach((d) => (copiaMelhor[d - 1] = 'F'));
      melhor.folgasMJ = [...folgasManuaisMJ].sort((a, b) => a - b);
      melhor.folgasS = [...folgasManuaisS].sort((a, b) => a - b);
    }

    // 4. Gerar Escala Visual (Mês Atual + 15 dias do próximo)
    melhor.escalaCompleta = this.construirEscalaFinal(ano, mes, copiaMelhor, base);

    return melhor;
  }

  private construirEscalaFinal(
    ano: number,
    mes: number,
    copiaMelhor: string[],
    baseOriginal: string[],
  ): DiaEscala[] {
    const escala: DiaEscala[] = [];

    // Mês Atual
    copiaMelhor.forEach((status, idx) => {
      escala.push({
        dia: idx + 1,
        mes: mes,
        ano: ano,
        status:
          status === 'F'
            ? baseOriginal[idx] === 'MENINO JESUS'
              ? 'Folga MENINO JESUS'
              : 'Folga SAMARITANO'
            : status,
      });
    });

    // Mês Seguinte (Projeção 1 a 15)
    const dataProx = new Date(ano, mes, 1);
    const proxMes = dataProx.getMonth() + 1;
    const proxAno = dataProx.getFullYear();

    let ultimoLocal = baseOriginal[baseOriginal.length - 1];
    let proxLocal = ultimoLocal === 'MENINO JESUS' ? 'SAMARITANO' : 'MENINO JESUS';

    for (let i = 1; i <= 15; i++) {
      escala.push({ dia: i, mes: proxMes, ano: proxAno, status: proxLocal });
      proxLocal = proxLocal === 'MENINO JESUS' ? 'SAMARITANO' : 'MENINO JESUS';
    }

    return escala;
  }

  private validarRegraDomingo(
    indicesAuto: number[],
    diasManuais: number[],
    ano: number,
    mes: number,
  ): boolean {
    let domingos = 0;
    indicesAuto.forEach((idx) => {
      if (new Date(ano, mes - 1, idx + 1).getDay() === 0) domingos++;
    });
    diasManuais.forEach((dia) => {
      if (new Date(ano, mes - 1, dia).getDay() === 0) domingos++;
    });
    return domingos <= 1;
  }

  private calcularMaiorSequencia(escala: string[]): number {
    let max = 0,
      atual = 0;
    for (const dia of escala) {
      if (dia !== 'F') {
        atual++;
        max = Math.max(max, atual);
      } else {
        atual = 0;
      }
    }
    return max;
  }

  private getCombinations(arr: number[], k: number): number[][] {
    if (k === 0) return [[]];
    const results: number[][] = [];
    const helper = (start: number, current: number[]) => {
      if (current.length === k) {
        results.push([...current]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        helper(i + 1, current);
        current.pop();
      }
    };
    helper(0, []);
    return results;
  }
}
