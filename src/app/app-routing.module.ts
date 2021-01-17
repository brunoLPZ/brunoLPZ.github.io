import {NgModule} from '@angular/core';
import {PreloadAllModules, RouterModule, Routes} from '@angular/router';
import {CvComponent} from './cv/cv.component';
import {BlogComponent} from './blog/blog.component';
import {ArticleComponent} from './blog/article/article.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'blog',
    pathMatch: 'full'
  },
  {
    path: 'blog',
    component: BlogComponent,
  },
  {
    path: 'blog/article/:id',
    component: ArticleComponent
  },
  {
    path: 'cv',
    component: CvComponent
  },
  {
    path: '**',
    redirectTo: 'blog'
  }

];

/**
 * Routing module for app module.
 */
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      /* enableTracing: true, */ // <-- debugging purposes only)
      preloadingStrategy: PreloadAllModules,
      scrollPositionRestoration: 'enabled', // or 'top'
      anchorScrolling: 'enabled',
      scrollOffset: [0, 64],
      onSameUrlNavigation: 'reload'
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
