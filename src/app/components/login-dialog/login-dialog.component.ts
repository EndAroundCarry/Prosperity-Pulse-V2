import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login-dialog.component.html',
  styleUrl: './login-dialog.component.css',
})
export class LoginDialogComponent {
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';
  hidePassword = true;

  private readonly authService = inject(AuthService);
  private readonly dialogRef = inject(MatDialogRef<LoginDialogComponent>);
  private readonly router = inject(Router);

  async submitLogin(): Promise<void> {
    if (!this.email || !this.password || this.isLoading) return;
    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.loginWithEmail(this.email, this.password);
      this.dialogRef.close(true);
      this.router.navigate(['/news-feed']);
    } catch (error: any) {
      console.error('Login failed', error);
      this.errorMessage = error?.message || 'Invalid email or password. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  async loginWithGoogle(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.loginWithGoogle();
      this.dialogRef.close(true);
      this.router.navigate(['/news-feed']);
    } catch (error: any) {
      console.error('Google login failed', error);
      this.errorMessage = error?.message || 'Google sign-in could not be completed.';
    } finally {
      this.isLoading = false;
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}

