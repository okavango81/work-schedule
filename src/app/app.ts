import { Component, signal } from '@angular/core';
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

  // Inputs
  ano = signal(2026);
  mes = signal(new Date().getMonth() + 1);
  localInicial = signal<'MENINO JESUS' | 'SAMARITANO'>('MENINO JESUS');
  diaFolgaFixa = signal<number | undefined>(undefined);

  // Resultado
  resultado = signal<Resultado | null>(null);

  constructor(private scheduleService: WorkSchedule) {}

  gerarEscala() {
    const res = this.scheduleService.calcularMelhorEscala(
      this.ano(),
      this.mes(),
      this.localInicial(),
      this.diaFolgaFixa()
    );
    this.resultado.set(res);
  }

  getDiasDoMes() {
    if (!this.resultado()) return [];
    const totalDias = new Date(this.ano(), this.mes(), 0).getDate();
    const dias = [];

    const res = this.resultado()!;
    for (let i = 1; i <= totalDias; i++) {
      // Criar data para pegar o dia da semana
      const dataRef = new Date(this.ano(), this.mes() - 1, i);
      const diaSemana = dataRef.toLocaleDateString('pt-BR', { weekday: 'short' })
        .replace('.', ''); // Ex: seg, ter, qua

      let status = (i % 2 !== 0 && this.localInicial() === 'MENINO JESUS') ||
      (i % 2 === 0 && this.localInicial() === 'SAMARITANO')
        ? 'MENINO JESUS' : 'SAMARITANO';

      if (res.folgasMJ.includes(i)) status = 'Folga MENINO JESUS';
      if (res.folgasS.includes(i)) status = 'Folga SAMARITANO';

      dias.push({
        dia: i,
        diaSemana: diaSemana.toUpperCase(),
        status
      });
    }
    return dias;
  }

  limpar() {
    this.ano.set(new Date().getFullYear());
    this.mes.set(new Date().getMonth() + 1);
    this.localInicial.set('MENINO JESUS');
    this.diaFolgaFixa.set(undefined);
    this.resultado.set(null);
  }
}
