import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './project/app/app.component';
import { config } from './project/app/app.config.server';

const bootstrap = () => bootstrapApplication(AppComponent, config);

export default bootstrap;
