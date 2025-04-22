import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css'],
})
export class LoginPageComponent {
  username: string = '';
  password: string = '';
  submitted: boolean = false;
  error: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(form: any) {
    this.submitted = true;
    this.error = '';

    if (form.valid) {
      this.authService
        .login({ username: this.username, password: this.password })
        .subscribe({
          next: (response) => {
            this.authService.setTokens(response.access, response.refresh);
            this.router.navigate(['/chat']);
          },
          error: (error) => {
            this.error =
              error.error.detail || 'Login failed. Please try again.';
          },
        });
    }
  }

  goToRegistration() {
    this.router.navigate(['/registration']);
  }
}
