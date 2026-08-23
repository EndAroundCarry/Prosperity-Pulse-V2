import { Component, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { LoginDialogComponent } from '../login-dialog/login-dialog.component';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Observable } from 'rxjs';
import { User } from 'firebase/auth';
import { AuthService } from '../../services/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AsyncPipe, CommonModule } from '@angular/common';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatTooltipModule,
    MatDividerModule,
    MatDialogModule,
    AsyncPipe,
    CommonModule,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent {
  readonly themeService = inject(ThemeService);
  readonly darkMode = this.themeService.isDark();
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  user$: Observable<User | null> = this.authService.currentUser$;
  showProfileMenu = false;

  toggleDarkMode(): void {
    this.themeService.toggle();
  }

  openLoginDialog(): void {
    this.dialog.open(LoginDialogComponent, {
      width: '420px',
      disableClose: false,
      panelClass: 'login-dialog',
    });
  }

  navigateToProfile(): void {
    this.showProfileMenu = false;
    this.router.navigate(['/profile']);
  }

  async logout(): Promise<void> {
    this.showProfileMenu = false;
    await this.authService.logout();
    this.router.navigate(['/']);
  }

  toggleProfileMenu(): void {
    this.showProfileMenu = !this.showProfileMenu;
  }

  closeProfileMenu(): void {
    this.showProfileMenu = false;
  }

  getInitials(name?: string | null, email?: string | null): string {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email && email.trim().length > 0) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'PP';
  }
}

