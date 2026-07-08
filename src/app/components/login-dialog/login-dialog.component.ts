import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatIconModule
  ],
  templateUrl: './login-dialog.component.html',
  styleUrl: './login-dialog.component.css'
})
export class LoginDialogComponent {
  email = '';
  password = '';
  private readonly authService = inject(AuthService);
  private readonly dialogRef = inject(MatDialogRef<LoginDialogComponent>);

  async submitLogin(): Promise<void> {
    if (this.email && this.password) {
      try {
        await this.authService.loginWithEmail(this.email, this.password);
        this.dialogRef.close(true);
      } catch (error) {
        console.error('Login failed', error);
      }
    }
  }

  async loginWithGoogle(): Promise<void> {
    try {
      await this.authService.loginWithGoogle();
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Google login failed', error);
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
