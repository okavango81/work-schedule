import { Component, signal, computed, HostListener, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Resultado, WorkSchedule } from './service/work-schedule';
import {LongPressDirective} from './directives/long-press-directive';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule, LongPressDirective],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  ano = signal(new Date().getFullYear());
  mes = signal(new Date().getMonth() +1);
  dropdownAberto = false;

  folgasManuaisMap = signal<Record<string, number[]>>({});
  folgasAutomaticasMap = signal<Record<string, number[]>>({});
  domingoManualMap = signal<Record<string, number | null>>({});

  folgasManuaisAtual = computed(() => {
    const chave = this.chaveMes(this.ano(), this.mes());
    return this.folgasManuaisMap()[chave] || [];
  });

  folgasAutomaticasAtual = computed(() => {
    const chave = this.chaveMes(this.ano(), this.mes());
    return this.folgasAutomaticasMap()[chave] || [];
  });

  domingoManualAtual = computed(() => {
    const chave = this.chaveMes(this.ano(), this.mes());
    return this.domingoManualMap()[chave] || null;
  });

  resultado = signal<Resultado | null>(null);
  mostrarBotaoSubir = signal(false);
  ultimaFolgaMesAnterior = signal(0);

  meses = [
    { valor: 1, nome: 'Janeiro' },
    { valor: 2, nome: 'Fevereiro' },
    { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' },
    { valor: 5, nome: 'Maio' },
    { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' },
    { valor: 8, nome: 'Agosto' },
    { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' },
    { valor: 11, nome: 'Novembro' },
    { valor: 12, nome: 'Dezembro' },
  ];

  constructor(private scheduleService: WorkSchedule) {
    this.gerarEscala();
  }

  getNomeMesAtual(): string {
    const m = this.meses.find((item) => item.valor === this.mes());
    return m ? m.nome : 'Selecione';
  }

  getNomeMes(valor: number): string {
    const m = this.meses.find((item) => item.valor === valor);
    return m ? m.nome : '';
  }

  getDiasEmBrancoInicio(): number[] {
    const primeiroDia = new Date(this.ano(), this.mes() - 1, 1).getDay();
    return Array(primeiroDia).fill(0);
  }

  getDiasParaExibir() {
    const dias: any[] = [];
    const ano = this.ano();
    const mesAtual = this.mes();
    const totalDiasMes = new Date(ano, mesAtual, 0).getDate();

    for (let d = 1; d <= totalDiasMes; d++) {
      const date = new Date(ano, mesAtual - 1, d);
      const isDomingo = date.getDay() === 0;
      dias.push({
        dia: d,
        mes: mesAtual,
        nomeMes: this.getNomeMes(mesAtual),
        isDomingo,
        status: this.obterStatus(d, mesAtual),
      });
    }

    const resto = 42 - dias.length;
    const mesProx = mesAtual === 12 ? 1 : mesAtual + 1;
    const anoProx = mesAtual === 12 ? ano + 1 : ano;
    for (let d = 1; d <= resto; d++) {
      const date = new Date(anoProx, mesProx - 1, d);
      dias.push({
        dia: d,
        mes: mesProx,
        nomeMes: this.getNomeMes(mesProx),
        isDomingo: date.getDay() === 0,
        status: 'Trabalho',
      });
    }
    return dias;
  }

  private obterStatus(dia: number, mes: number): string {
    if (mes !== this.mes()) return 'Trabalho';
    const resultado = this.resultado();
    if (!resultado) return 'Trabalho';
    return resultado.folgas.includes(dia) ? 'Folga' : 'Trabalho';
  }

  selecionarMes(valorMes: number) {
    this.mes.set(valorMes);
    this.dropdownAberto = false;
    this.gerarEscala();
  }

  limpar() {
    const chave = this.chaveMes(this.ano(), this.mes());
    this.folgasManuaisMap.update((map) => ({ ...map, [chave]: [] }));
    this.domingoManualMap.update((map) => ({ ...map, [chave]: null }));
    this.gerarEscala();
  }

  alternarFolgaManual(dia: number, mesItem: number) {
    if (mesItem !== this.mes()) return;

    const chave = this.chaveMes(this.ano(), this.mes());
    let manuais = [...this.folgasManuaisAtual()];
    const idx = manuais.indexOf(dia);

    if (idx > -1) {
      // Se clicou no mesmo dia, apenas desmarca
      manuais.splice(idx, 1);
    } else {
      // REGRA: A nova marcação anula as antigas conflitantes

      // 1. Remove qualquer manual que quebre a distância mínima de 5 dias
      manuais = manuais.filter((m) => Math.abs(m - dia) >= 5);

      // 2. Se for domingo, remove qualquer outro domingo marcado manualmente
      const isDomingo = new Date(this.ano(), this.mes() - 1, dia).getDay() === 0;
      if (isDomingo) {
        manuais = manuais.filter((m) => new Date(this.ano(), this.mes() - 1, m).getDay() !== 0);
      }

      // Adiciona a nova escolha soberana
      manuais.push(dia);
      manuais.sort((a, b) => a - b);
    }

    this.folgasManuaisMap.update((map) => ({ ...map, [chave]: manuais }));

    // Recalcula a escala do zero com as manuais limpas
    this.gerarEscala();
  }

  private encontrarDomingoAutomatico(): number | null {
    const resultado = this.resultado();
    if (!resultado) return null;
    const domingos = resultado.folgas.filter((d) => {
      const dt = new Date(this.ano(), this.mes() - 1, d);
      return dt.getDay() === 0;
    });
    return domingos.length > 0 ? domingos[0] : null;
  }

  gerarEscala() {
    console.log('gerarEscala INICIADO');

    try {
      let mesAnt = this.mes() - 1;
      let anoAnt = this.ano();
      if (mesAnt === 0) {
        mesAnt = 12;
        anoAnt--;
      }

      const chaveAnt = this.chaveMes(anoAnt, mesAnt);
      const folgasManuaisAnt = this.folgasManuaisMap()[chaveAnt] || [];
      const folgasAutomaticasAnt = this.folgasAutomaticasMap()[chaveAnt] || [];

      console.log('Mês anterior:', anoAnt, mesAnt);
      console.log('Manuais mês anterior:', folgasManuaisAnt);
      console.log('Automaticas mês anterior:', folgasAutomaticasAnt);

      const resAnterior = this.scheduleService.calcularMelhorEscala(
        anoAnt,
        mesAnt,
        folgasManuaisAnt,
        0,
      );
      this.ultimaFolgaMesAnterior.set(resAnterior.ultimaFolgaMes);
      console.log('Última folga mês anterior:', resAnterior.ultimaFolgaMes);

      const domingoManual = this.domingoManualAtual();
      const manuais = this.folgasManuaisAtual();
      const automáticasExistentes = this.folgasAutomaticasAtual();

      console.log('Mês atual:', this.ano(), this.mes());
      console.log('Manuais atuais:', manuais);
      console.log('Automáticas existentes:', automáticasExistentes);
      console.log('Domingo manual:', domingoManual);

      const resAtual = this.scheduleService.calcularMelhorEscala(
        this.ano(),
        this.mes(),
        manuais,
        this.ultimaFolgaMesAnterior(),
        domingoManual || undefined,
      );

      console.log('Resultado do serviço:', resAtual);

      this.resultado.set(resAtual);

      const automáticas = resAtual.folgas.filter((d) => !manuais.includes(d));
      const chaveAtual = this.chaveMes(this.ano(), this.mes());
      this.folgasAutomaticasMap.update((map) => ({ ...map, [chaveAtual]: automáticas }));

      console.log('resultado final:', this.resultado());
    } catch (error) {
      console.error('Erro ao calcular escala:', error);
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    this.mostrarBotaoSubir.set(scrollY > 300);
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private chaveMes(ano: number, mes: number): string {
    return `${ano}-${mes.toString().padStart(2, '0')}`;
  }

  // enviarWhatsApp() {
  //   const resultado = this.resultado();
  //   if (!resultado || !resultado.folgas || resultado.folgas.length === 0) {
  //     alert('Nenhuma folga definida para este mês.');
  //     return;
  //   }
  //
  //   const mesNome = this.getNomeMesAtual();
  //   const folgas = resultado.folgas.join(', ');
  //   const sequencia = resultado.maiorSequencia;
  //   const total = resultado.folgas.length;
  //
  //   const mensagem =
  //     `🏥 *Escala Sabará*` +
  //     '\n' +
  //     `📅 ${mesNome}` +
  //     '\n' +
  //     '\n\n' +
  //     `📌 *Dias de folga:*` +
  //     '\n' +
  //     `${folgas}` +
  //     '\n\n' +
  //     `⚡ *Maior seqência:* ${sequencia} dias` +
  //     '\n' +
  //     `📊 *Total no mês:* ${total} folga${total > 1 ? 's' : ''}` +
  //     '\n';
  //
  //   const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
  //   window.open(url, '_blank');
  // }

  enviarWhatsApp() {
    const resultado = this.resultado();
    if (!resultado || !resultado.folgas || resultado.folgas.length === 0) {
      alert('Nenhuma folga definida para este mês.');
      return;
    }

    const mesNome = this.getNomeMesAtual();
    const folgas = resultado.folgas.join(', ');
    const sequencia = resultado.maiorSequencia;
    const total = resultado.folgas.length;

    const mensagem = `· · · · · · · · · · · · · · · · · · · · · · ·

*Escala Sabará*
${mesNome}

· · · · · · · · · · · · · · · · · · · · · · ·

*Folgas agendadas*
${folgas}

· · · · · · · · · · · · · · · · · · · · · · ·

Maior sequência: ${sequencia} dias
Total no mês: ${total} folga${total > 1 ? 's' : ''}

· · · · · · · · · · · · · · · · · · · · · · ·`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  }
}
