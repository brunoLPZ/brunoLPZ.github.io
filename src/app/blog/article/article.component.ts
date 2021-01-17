import {Component, Input, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Article, ARTICLES} from './articles';
import { MarkdownService } from "ngx-markdown";
import { Slugger } from "marked";

@Component({
  selector: 'app-article',
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.css']
})
export class ArticleComponent implements OnInit {

  articleId: number;
  @Input()
  title: string;
  contentTable = [];
  currentArticle: Article;
  index = 1;
  constructor(private route: ActivatedRoute, private markdownService: MarkdownService) {
  }

  ngOnInit() {
    this.articleId = +this.route.snapshot.paramMap.get('id');
    this.currentArticle = ARTICLES.find(article => article.id === this.articleId);

    this.markdownService.renderer.heading = (text: string, level: number) => {
      const titleIndex = this.index;
      this.contentTable.push({anchor: `section${titleIndex}`, title: text, level: level});
      this.index++;
      return `<a name="section${titleIndex}" class="anchor"></a>
              <h${level}>${text}</h${level}>`;
    };
  }
}
