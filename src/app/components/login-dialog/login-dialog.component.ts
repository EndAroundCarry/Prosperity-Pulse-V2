import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AngularFireAuth } from '@angular/fire/auth';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GoogleAuthProvider } from 'firebase/auth';

@Component({
  selector: 'app-login-dialog',
  templateUrl: './login-dialog.component.html',
  styleUrls: ['./login-dialog.component.css']
})
export class LoginDialogComponent {
  loginForm: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<LoginDialogComponent>,
    private afAuth: AngularFireAuth,
    private fb: FormBuilder
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async loginWithEmail() {
    this.loading = true;
    this.error = null;
    const { email, password } = this.loginForm.value;
    try {
      await this.afAuth.signInWithEmailAndPassword(email, password);
      this.dialogRef.close();
    } catch (err: any) {
      this.error = err.message || 'Login failed';
    } finally {
      this.loading = false;
    }
  }

  async loginWithGoogle() {
    this.loading = true;
    this.error = null;
    try {
      await this.afAuth.signInWithPopup(new GoogleAuthProvider());
      this.dialogRef.close();
    } catch (err: any) {
      this.error = err.message || 'Google login failed';
    } finally {
      this.loading = false;
    }
  }

  close() {
    this.dialogRef.close();
  }
}
