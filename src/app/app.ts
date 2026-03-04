import { Component, signal, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Resultado, WorkSchedule } from './service/work-schedule';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Configurações Iniciais
  ano = signal(2026);
  mes = signal(new Date().getMonth() + 1);
  localInicial = signal<'MENINO JESUS' | 'SAMARITANO'>('MENINO JESUS');

  // Controle de Folgas Manuais
  folgasManuaisMJ = signal<number[]>([]);
  folgasManuaisS = signal<number[]>([]);

  // Armazenamento do Cálculo
  resultado = signal<Resultado | null>(null);

  // Signal para controlar se o botão aparece ou não
  mostrarBotaoSubir = signal(false);

  constructor(private scheduleService: WorkSchedule) {
    // Gera a escala inicial automaticamente ao abrir
    this.gerarEscala();
  }

  // Dentro da classe App
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

  // Escuta o evento de scroll da janela
  @HostListener('window:scroll', [])
  onWindowScroll() {
    // Se o scroll passar de 300px, mostra o botão
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    this.mostrarBotaoSubir.set(scrollY > 300);
  }

  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth', // Subida suave
    });
  }

  gerarEscala() {
    try {
      const res = this.scheduleService.calcularMelhorEscala(
        this.ano(),
        this.mes(),
        this.localInicial(),
        this.folgasManuaisMJ(),
        this.folgasManuaisS(),
      );
      this.resultado.set(res);
    } catch (error) {
      console.error('Erro ao calcular escala:', error);
    }
  }

  alternarFolgaManual(dia: number, mesItem: number, statusAtual: string) {
    if (mesItem !== this.mes()) return;

    const mj = [...this.folgasManuaisMJ()];
    const sam = [...this.folgasManuaisS()];
    const ordenar = (list: number[]) => list.sort((a, b) => a - b);

    if (mj.includes(dia)) {
      this.folgasManuaisMJ.set(ordenar(mj.filter((d) => d !== dia)));
    } else if (sam.includes(dia)) {
      this.folgasManuaisS.set(ordenar(sam.filter((d) => d !== dia)));
    } else if (statusAtual === 'MENINO JESUS') {
      if (mj.length < 2) {
        this.folgasManuaisMJ.set(ordenar([...mj, dia]));
      }
    } else if (statusAtual === 'SAMARITANO') {
      // NOVA REGRA: Valida se a quinzena do dia clicado já está ocupada
      const isPrimeiraQuinzena = dia <= 15;
      const jaTemNaQuinzena = sam.some((d) => (isPrimeiraQuinzena ? d <= 15 : d >= 16));

      if (!jaTemNaQuinzena && sam.length < 2) {
        this.folgasManuaisS.set(ordenar([...sam, dia]));
      } else if (jaTemNaQuinzena) {
        // Opcional: Alerta para o usuário entender o bloqueio
        console.warn('O Samaritano exige folgas em quinzenas diferentes (Ciclo 16-15).');
      }
    }

    this.gerarEscala();
  }

  getDiasParaExibir() {
    const res = this.resultado();
    if (!res || !res.escalaCompleta) return [];

    return res.escalaCompleta.map((item) => {
      // Cria a data correta para cada item (mês atual ou próximo)
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
    this.folgasManuaisMJ.set([]);
    this.folgasManuaisS.set([]);
    this.gerarEscala();
  }
}
