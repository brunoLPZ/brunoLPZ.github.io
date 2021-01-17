import { BrowserModule } from '@angular/platform-browser';
import { NgModule, SecurityContext } from '@angular/core';

import { AppComponent } from './app.component';
import { FlexLayoutModule } from '@angular/flex-layout';
import { CvComponent } from './cv/cv.component';
import { ContactComponent } from './cv/contact/contact.component';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { BodyComponent } from './cv/body/body.component';
import { AppRoutingModule } from './app-routing.module';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { EntryComponent } from './blog/entry/entry.component';
import { BlogComponent } from './blog/blog.component';
import { ArticleComponent } from './blog/article/article.component';
import { FormatPipe } from './pipes/format.pipe';
import { MarkdownModule } from 'ngx-markdown';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatListModule } from '@angular/material/list';
import { MatButtonToggleModule } from "@angular/material/button-toggle";

@NgModule({
  declarations: [
    AppComponent,
    CvComponent,
    ContactComponent,
    BodyComponent,
    BlogComponent,
    EntryComponent,
    ArticleComponent,
    FormatPipe
  ],
  imports: [
    BrowserModule,
    FlexLayoutModule,
    MatIconModule,
    MatDividerModule,
    AppRoutingModule,
    MatToolbarModule,
    MatButtonModule,
    MatCardModule,
    MatTableModule,
    MatMenuModule,
    BrowserAnimationsModule,
    HttpClientModule,
    MarkdownModule.forRoot({
      sanitize: SecurityContext.NONE,
      loader: HttpClient
    }),
    MatListModule,
    MatButtonToggleModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
