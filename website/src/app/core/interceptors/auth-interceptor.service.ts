import { HttpEvent, HttpHandler, HttpHeaders, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ReCaptchaV3Service } from 'ng-recaptcha';
import { iif, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Environment } from '../interfaces/environment.interface';
import { EnvironmentService } from '../services/environment.service';

@Injectable({
  providedIn: 'root',
})
export class AuthInterceptorService implements HttpInterceptor {
  constructor(private recaptchaV3Service: ReCaptchaV3Service, private envService: EnvironmentService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.shouldCaptchaRequest(request)) {
      return this.captchaRequest(request, next);
    }
    return next.handle(request);
  }

  private captchaRequest(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return iif(
      () => this.environment.production,
      this.recaptchaV3Service.execute('importantAction'),
      of(this.environment.siteKeyCaptcha),
    ).pipe(
      switchMap((token) => {
        const newRequest = request.clone({
          headers: new HttpHeaders({
            'x-captcha': token,
          }),
        });

        return next.handle(newRequest);
      }),
    );
  }

  private shouldCaptchaRequest(request: HttpRequest<any>): boolean {
    return request.method !== 'GET';
  }

  get environment(): Environment {
    return this.envService.environment;
  }
}
