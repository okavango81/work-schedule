import { Component, signal} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Resultado, WorkSchedule } from './service/work-schedule';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
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

  constructor(private scheduleService: WorkSchedule) {
    // Gera a escala inicial automaticamente ao abrir
    this.gerarEscala();
  }

  gerarEscala() {
    try {
      const res = this.scheduleService.calcularMelhorEscala(
        this.ano(),
        this.mes(),
        this.localInicial(),
        this.folgasManuaisMJ(),
        this.folgasManuaisS()
      );
      this.resultado.set(res);
    } catch (error) {
      console.error("Erro ao calcular escala:", error);
    }
  }

  alternarFolgaManual(dia: number, mesItem: number, statusAtual: string) {
    // Impede alteração nos dias do mês seguinte (visualização apenas)
    if (mesItem !== this.mes()) return;

    const mj = [...this.folgasManuaisMJ()];
    const sam = [...this.folgasManuaisS()];

    // Lógica de alternância (Toggle)
    if (mj.includes(dia)) {
      this.folgasManuaisMJ.set(mj.filter(d => d !== dia));
    } else if (sam.includes(dia)) {
      this.folgasManuaisS.set(sam.filter(d => d !== dia));
    } else if (statusAtual === 'MENINO JESUS') {
      if (mj.length < 2) {
        mj.push(dia);
        this.folgasManuaisMJ.set(mj);
      }
    } else if (statusAtual === 'SAMARITANO') {
      if (sam.length < 2) {
        sam.push(dia);
        this.folgasManuaisS.set(sam);
      }
    }

    this.gerarEscala();
  }

  getDiasParaExibir() {
    const res = this.resultado();
    if (!res || !res.escalaCompleta) return [];

    return res.escalaCompleta.map(item => {
      // Cria a data correta para cada item (mês atual ou próximo)
      const dataRef = new Date(item.ano, item.mes - 1, item.dia);
      return {
        ...item,
        diaSemana: dataRef.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(),
        isSabado:dataRef.getDay() === 6,
        isDomingo: dataRef.getDay() === 0,
        nomeMes: dataRef.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()
      };
    });
  }

  limpar() {
    this.folgasManuaisMJ.set([]);
    this.folgasManuaisS.set([]);
    this.gerarEscala();
  }
}
