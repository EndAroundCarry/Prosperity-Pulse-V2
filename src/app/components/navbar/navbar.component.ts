import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { LoginDialogComponent } from '../login-dialog/login-dialog.component';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Observable } from 'rxjs';
import { User } from 'firebase/auth';
import { AuthService } from '../../services/auth.service';
import { CommandPaletteComponent } from '../command-palette/command-palette.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AsyncPipe, CommonModule } from '@angular/common';

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
export class NavbarComponent implements OnInit {
  darkMode = false;
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  user$: Observable<User | null> = this.authService.currentUser$;
  showProfileMenu = false;

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.openCommandPalette();
    }
  }

  ngOnInit(): void {
    const savedMode = window.localStorage.getItem('prosperity-pulse-dark-mode');
    this.darkMode = savedMode === 'true';
    this.applyTheme(this.darkMode);
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    this.applyTheme(this.darkMode);
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

  private applyTheme(enabled: boolean): void {
    document.body.classList.toggle('dark-mode', enabled);
    window.localStorage.setItem('prosperity-pulse-dark-mode', String(enabled));
  }

  toggleProfileMenu(): void {
    this.showProfileMenu = !this.showProfileMenu;
  }

  closeProfileMenu(): void {
    this.showProfileMenu = false;
  }

  openCommandPalette(): void {
    this.dialog.open(CommandPaletteComponent, {
      width: '560px',
      maxWidth: '90vw',
      panelClass: 'command-palette-dialog',
      hasBackdrop: false,
    });
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

