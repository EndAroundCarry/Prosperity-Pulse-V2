import { Component, OnInit, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialog } from '@angular/material/dialog';
import { LoginDialogComponent } from '../login-dialog/login-dialog.component';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { User } from 'firebase/auth';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [MatToolbarModule],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit {
  darkMode = false;
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  user$: Observable<User | null> = this.authService.currentUser$;

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
      width: '400px',
      disableClose: true
    });
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  private applyTheme(enabled: boolean): void {
    document.body.classList.toggle('dark-mode', enabled);
    window.localStorage.setItem('prosperity-pulse-dark-mode', String(enabled));
  }
}
