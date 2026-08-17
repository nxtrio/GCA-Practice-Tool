# Security

GCA Practice is a single-user, localhost application. It is not a security
sandbox and must never be exposed as a network service.

## Native code execution

The application executes two kinds of native local code:

- Python reference solutions contained in assessment JSON, during validation
- Java, C++, or Python solutions entered in the assessment editor

Either can deliberately read or modify local files, use the network, consume
system resources, or spawn processes. Runner subprocesses receive a reduced
environment, but this does not prevent access to the rest of the machine.
Only import assessments and run solutions that you trust.

Timeouts, output limits, temporary workspaces, process-tree termination, and
source/import size limits protect against accidental broken code. They are not
designed to contain malicious code.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository when
available. Do not include secrets or exploit details in a public issue.
