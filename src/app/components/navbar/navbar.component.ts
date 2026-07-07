import { Component, OnInit } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-navbar',
  imports: [MatToolbarModule],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit {
  darkMode = false;

  ngOnInit(): void {
    const savedMode = window.localStorage.getItem('prosperity-pulse-dark-mode');
    this.darkMode = savedMode === 'true';
    this.applyTheme(this.darkMode);
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    this.applyTheme(this.darkMode);
  }

  private applyTheme(enabled: boolean): void {
    document.body.classList.toggle('dark-mode', enabled);
    window.localStorage.setItem('prosperity-pulse-dark-mode', String(enabled));
  }
}
