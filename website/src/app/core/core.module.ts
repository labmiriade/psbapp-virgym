import { APP_INITIALIZER, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BaseUrlInterceptorService } from './interceptors/base-url-interceptor.service';
import { AuthInterceptorService } from './interceptors/auth-interceptor.service';
import { RecaptchaV3Module, RECAPTCHA_V3_SITE_KEY } from 'ng-recaptcha';
import { EnvironmentService } from './services/environment.service';

function initApp(envService: EnvironmentService) {
  return () =>
    envService.init().then((value) => {
      envService.environment = value;
      return value;
    });
}

function siteKeyCaptcha(envService: EnvironmentService) {
  return envService.environment.siteKeyCaptcha;
}

@NgModule({
  declarations: [],
  imports: [CommonModule, HttpClientModule, RecaptchaV3Module],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: BaseUrlInterceptorService,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptorService,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initApp,
      deps: [EnvironmentService],
      multi: true,
    },
    { provide: RECAPTCHA_V3_SITE_KEY, useFactory: siteKeyCaptcha, deps: [EnvironmentService] },
  ],
})
export class CoreModule {}
