class UserAlreadyExistsError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


class IncorrectPasswordError(Exception):
    pass


class PasswordUnchangedError(Exception):
    pass


class SelfDeletionForbiddenError(Exception):
    pass


class InsufficientPrivilegesError(Exception):
    pass
