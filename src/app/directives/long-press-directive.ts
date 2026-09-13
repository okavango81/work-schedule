import { Directive, EventEmitter, HostListener, Output, Input } from '@angular/core';

@Directive({
  selector: '[appLongPress]',
  standalone: true,
})
export class LongPressDirective {
  @Output() longPress = new EventEmitter<void>();
  @Input() appLongPress: number = 800;

  private timeout: any;
  private isPressed = false;

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    console.log('mousedown');
    event.preventDefault();
    this.startPress();
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    console.log('touchstart');
    event.preventDefault();
    this.startPress();
  }

  @HostListener('mouseup')
  @HostListener('mouseleave')
  @HostListener('touchend')
  @HostListener('touchcancel')
  onRelease() {
    console.log('release');
    this.isPressed = false;
    clearTimeout(this.timeout);
  }

  private startPress() {
    this.isPressed = true;
    this.timeout = setTimeout(() => {
      if (this.isPressed) {
        console.log('LONG PRESS DISPARADO!');
        this.longPress.emit();
      }
    }, this.appLongPress);
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: Event) {
    event.preventDefault();
  }

  @HostListener('selectstart', ['$event'])
  onSelectStart(event: Event) {
    event.preventDefault();
  }
}
