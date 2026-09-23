export class Defer<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void = ()=>{};
    reject: (reason?: any) => void = ()=>{};

    constructor(timeout:Number | undefined = undefined, homey:any = undefined) {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
        if(homey && timeout) {
            let timeoutId = homey.setTimeout(()=>{
                this.reject('timeout');
            }, timeout);
            this.promise.then(()=> { homey.clearTimeout(timeoutId); });
            this.promise.catch(()=> { homey.clearTimeout(timeoutId); });
        }
    }
}