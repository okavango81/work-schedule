import { Component, signal, computed, HostListener, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Resultado, WorkSchedule } from './service/work-schedule';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  ano = signal(2026);
  mes = signal(8); // Agosto

  dropdownAberto = false;

  folgasManuaisMap = signal<Record<string, number[]>>({});

  folgasManuaisAtual = computed(() => {
    const chave = `${this.ano()}-${this.mes().toString().padStart(2, '0')}`;
    return this.folgasManuaisMap()[chave] || [];
  });

  resultado = signal<Resultado | null>(null);
  mostrarBotaoSubir = signal(false);

  ultimaFolgaMesAnterior = signal(0);

  constructor(private scheduleService: WorkSchedule) {
    this.gerarEscala();
  }

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

  getNomeMesAtual(): string {
    const m = this.meses.find((item) => item.valor === this.mes());
    return m ? m.nome : 'Selecione';
  }

  selecionarMes(valorMes: number) {
    this.mes.set(valorMes);
    this.dropdownAberto = false;
    this.gerarEscala();
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    this.mostrarBotaoSubir.set(scrollY > 300);
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  gerarEscala() {
    try {
      let mesAnt = this.mes() - 1;
      let anoAnt = this.ano();
      if (mesAnt === 0) {
        mesAnt = 12;
        anoAnt--;
      }

      const chaveAnt = `${anoAnt}-${mesAnt.toString().padStart(2, '0')}`;
      const folgasAnt = this.folgasManuaisMap()[chaveAnt] || [];

      const resAnterior = this.scheduleService.calcularMelhorEscala(anoAnt, mesAnt, folgasAnt, 0);
      this.ultimaFolgaMesAnterior.set(resAnterior.ultimaFolgaMes);

      const resAtual = this.scheduleService.calcularMelhorEscala(
        this.ano(),
        this.mes(),
        this.folgasManuaisAtual(),
        resAnterior.ultimaFolgaMes,
      );

      this.resultado.set(resAtual);
    } catch (error) {
      console.error('Erro ao calcular escala:', error);
    }
  }

  alternarFolgaManual(dia: number, mesItem: number) {
    if (mesItem !== this.mes()) return;

    let atuais = [...this.folgasManuaisAtual()].sort((a, b) => a - b);
    const dataClicada = new Date(this.ano(), this.mes() - 1, dia);
    const isDomingoClicado = dataClicada.getDay() === 0;

    if (atuais.includes(dia)) {
      // Remover folga
      atuais = atuais.filter((d) => d !== dia);
    } else {
      // 1. Proíbe folgas seguidas
      if (atuais.includes(dia - 1) || atuais.includes(dia + 1)) {
        alert('Regra violada: Não é permitido marcar duas folgas seguidas!');
        return;
      }

      // 2. Garante o ciclo mínimo de 4 dias de trabalho entre folgas
      const folgaAnterior = [...atuais].filter((d) => d < dia).pop();
      const proximaFolga = [...atuais].filter((d) => d > dia).shift();

      if (folgaAnterior && dia - folgaAnterior - 1 < 4) {
        alert('Regra violada: O ciclo mínimo de trabalho entre folgas é de 4 dias!');
        return;
      }

      if (proximaFolga && proximaFolga - dia - 1 < 4) {
        alert('Regra violada: O ciclo mínimo de trabalho entre folgas é de 4 dias!');
        return;
      }

      // 3. Regra do Domingo Único
      if (isDomingoClicado) {
        atuais = atuais.filter((d) => {
          const dataExistente = new Date(this.ano(), this.mes() - 1, d);
          return dataExistente.getDay() !== 0;
        });
      }

      // 4. Limite de 6 folgas no mês
      if (atuais.length >= 6) {
        alert('Limite de 6 folgas manuais atingido!');
        return;
      }

      // 5. Validação de no máximo 2 folgas em qualquer janela de 14 dias
      const novaLista = [...atuais, dia];
      if (
        !this.scheduleService.validarRegra14Dias(
          this.ano(),
          this.mes(),
          novaLista,
          this.ultimaFolgaMesAnterior(),
        )
      ) {
        alert('Regra violada: não pode ter mais de 2 folgas em qualquer janela de 14 dias!');
        return;
      }

      atuais.push(dia);
    }

    const chave = `${this.ano()}-${this.mes().toString().padStart(2, '0')}`;
    this.folgasManuaisMap.update((map) => ({ ...map, [chave]: atuais.sort((a, b) => a - b) }));

    this.gerarEscala();
  }

  getDiasParaExibir() {
    const res = this.resultado();
    if (!res || !res.escalaCompleta) return [];

    return res.escalaCompleta.map((item) => {
      const dataRef = new Date(item.ano, item.mes - 1, item.dia);
      return {
        ...item,
        diaSemana: dataRef
          .toLocaleDateString('pt-BR', { weekday: 'short' })
          .replace('.', '')
          .toUpperCase(),
        isSabado: dataRef.getDay() === 6,
        isDomingo: dataRef.getDay() === 0,
        nomeMes: dataRef.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase(),
      };
    });
  }

  limpar() {
    const chave = `${this.ano()}-${this.mes().toString().padStart(2, '0')}`;
    this.folgasManuaisMap.update((map) => ({ ...map, [chave]: [] }));
    this.gerarEscala();
  }
}
