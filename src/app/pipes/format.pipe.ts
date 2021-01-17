import {Pipe, PipeTransform} from '@angular/core';

@Pipe({name: 'format'})
export class FormatPipe implements PipeTransform {
  transform(value: string): string {
    return value.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
  }
}
