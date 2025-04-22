import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-registration-page',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './registration-page.component.html',
  styleUrls: ['./registration-page.component.css'],
})
export class RegistrationPageComponent implements OnInit {
  username: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  submitted: boolean = false;
  error: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('access_token');
      if (token) {
        this.router.navigate(['/chat']);
      }
    }
  }

  onSubmit(form: any) {
    this.submitted = true;
    this.error = '';

    if (form.valid && this.password === this.confirmPassword) {
      this.authService
        .register({
          username: this.username,
          email: this.email,
          password: this.password,
        })
        .subscribe({
          next: () => {
            this.router.navigate(['/login']);
          },
          error: (error) => {
            this.error =
              error.error.detail || 'Registration failed. Please try again.';
          },
        });
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
