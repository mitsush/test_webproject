import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './project/app/app.config';
import { AppComponent } from './project/app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
