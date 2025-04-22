import { Routes } from '@angular/router';
import { RegistrationPageComponent } from '../pages/registration-page/registration-page.component';
import { LoginPageComponent } from '../pages/login-page/login-page.component';
import { ChatComponent } from '../pages/chat/chat.component';
import { SettingsComponent } from '../pages/settings/settings.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'registration',
    pathMatch: 'full',
  },
  {
    path: 'registration',
    component: RegistrationPageComponent,
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginPageComponent,
    pathMatch: 'full',
  },
  {
    path: 'chat',
    component: ChatComponent,
    pathMatch: 'full',
  },
  {
    path: 'settings',
    component: SettingsComponent,
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'registration',
  },
];
