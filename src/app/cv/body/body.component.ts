import {Component} from '@angular/core';

export interface Idioma {
  listening: string;
  reading: string;
  oralProduction: string;
  oralInteraction: string;
  writing: string;
}

const IDIOMAS: Idioma[] = [
  {listening: 'B1', reading: 'B1', oralProduction: 'B1', oralInteraction: 'B1', writing: 'B1'}
];

@Component({
  selector: 'app-body',
  templateUrl: './body.component.html',
  styleUrls: ['./body.component.css']
})
export class BodyComponent {
  displayedColumns: string[] = ['listening', 'reading', 'oralProduction', 'oralInteraction', 'writing'];
  dataSource = IDIOMAS;
}
